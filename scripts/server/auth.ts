import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import type pg from "pg";
import type { CustomerRow } from "./db";

export type CustomerPayload = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  created_at: string;
  updated_at: string;
};

type TokenPayload = {
  sub: string;
  phone: string;
  exp: number;
};

const normalizePhone = (phone: string) => {
  const cleaned = phone.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  if (cleaned.startsWith("996")) {
    return `+${cleaned}`;
  }
  return cleaned;
};

const toCustomer = (row: CustomerRow): CustomerPayload => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  address: row.address,
  created_at: new Date(row.created_at).toISOString(),
  updated_at: new Date(row.updated_at).toISOString()
});

const base64Url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");

const sign = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("base64url");

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAccessToken(customer: CustomerPayload, secret: string) {
  const payload: TokenPayload = {
    sub: customer.id,
    phone: customer.phone,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyAccessToken(token: string, secret: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, secret);
  if (
    expectedSignature.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as TokenPayload;
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function bearerToken(header: string | string[] | undefined) {
  if (Array.isArray(header)) {
    return bearerToken(header[0]);
  }
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function registerCustomer(
  pool: pg.Pool,
  payload: { name?: string; phone?: string; address?: string; password?: string },
  secret: string
) {
  const name = payload.name?.trim();
  const phone = normalizePhone(payload.phone ?? "");
  const address = payload.address?.trim() || null;
  const password = payload.password ?? "";

  if (!name || !phone || password.length < 6) {
    throw Object.assign(new Error("Заполните имя, телефон и пароль минимум из 6 символов."), {
      statusCode: 400
    });
  }

  const existing = await pool.query("SELECT id FROM app_customers WHERE phone = $1 LIMIT 1", [phone]);
  if (existing.rowCount) {
    throw Object.assign(new Error("Пользователь с таким телефоном уже зарегистрирован."), {
      statusCode: 409
    });
  }

  const row = await pool.query<CustomerRow>(
    `INSERT INTO app_customers (id, name, phone, address, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, phone, address, password_hash, created_at, updated_at`,
    [randomUUID(), name, phone, address, hashPassword(password)]
  );
  const user = toCustomer(row.rows[0]);

  return {
    session: {
      accessToken: createAccessToken(user, secret),
      refreshToken: null
    },
    user
  };
}

export async function loginCustomer(
  pool: pg.Pool,
  payload: { phone?: string; password?: string },
  secret: string
) {
  const phone = normalizePhone(payload.phone ?? "");
  const password = payload.password ?? "";
  const row = await pool.query<CustomerRow>(
    "SELECT id, name, phone, address, password_hash, created_at, updated_at FROM app_customers WHERE phone = $1 LIMIT 1",
    [phone]
  );
  const customer = row.rows[0];

  if (!customer || !verifyPassword(password, customer.password_hash)) {
    throw Object.assign(new Error("Неверный телефон или пароль"), {
      statusCode: 401
    });
  }

  const user = toCustomer(customer);
  return {
    session: {
      accessToken: createAccessToken(user, secret),
      refreshToken: null
    },
    user
  };
}

export async function getCustomerProfile(pool: pg.Pool, customerId: string) {
  const row = await pool.query<CustomerRow>(
    "SELECT id, name, phone, address, password_hash, created_at, updated_at FROM app_customers WHERE id = $1 LIMIT 1",
    [customerId]
  );

  if (!row.rows[0]) {
    throw Object.assign(new Error("Профиль не найден."), {
      statusCode: 404
    });
  }

  return { user: toCustomer(row.rows[0]) };
}

export async function updateCustomerProfile(
  pool: pg.Pool,
  customerId: string,
  payload: { name?: string; phone?: string; address?: string }
) {
  const name = payload.name?.trim() || "Покупатель";
  const phone = normalizePhone(payload.phone ?? "");
  const address = payload.address?.trim() || null;

  if (!phone) {
    throw Object.assign(new Error("Введите телефон."), {
      statusCode: 400
    });
  }

  try {
    const row = await pool.query<CustomerRow>(
      `UPDATE app_customers
       SET name = $1, phone = $2, address = $3, updated_at = now()
       WHERE id = $4
       RETURNING id, name, phone, address, password_hash, created_at, updated_at`,
      [name, phone, address, customerId]
    );

    if (!row.rows[0]) {
      throw Object.assign(new Error("Профиль не найден."), {
        statusCode: 404
      });
    }

    return { user: toCustomer(row.rows[0]) };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw Object.assign(new Error("Пользователь с таким телефоном уже зарегистрирован."), {
        statusCode: 409
      });
    }
    throw error;
  }
}
