import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type pg from "pg";
import type { CustomerRow } from "./db";
import { consumePhoneProof, fail, rateLimit, type PhoneProof } from "./security";
import {
  createPlumberApplicationRecord,
  getPlumberProfileByAccount,
  type PlumberApplicationInput
} from "./plumbers";

export type AccountRole = "customer" | "plumber" | "admin";

export type CustomerPayload = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  accountType: "customer" | "plumber";
  roles: AccountRole[];
  isAdmin: boolean;
  plumber: Awaited<ReturnType<typeof getPlumberProfileByAccount>>;
  created_at: string;
  updated_at: string;
};

type TokenPayload = { sub: string; sid: string; v: 2; exp: number };

export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("996")) return `+${digits}`;
  if (digits.startsWith("0")) return `+996${digits.slice(1)}`;
  if (digits.length === 9) return `+996${digits}`;
  return `+${digits}`;
};

export const isValidAccountPhone = (phone: string) => /^\+996\d{9}$/.test(normalizePhone(phone));

const base64Url = (value: Buffer | string) => Buffer.from(value).toString("base64url");
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createAccessToken(customer: CustomerPayload, secret: string, sessionId: string) {
  const payload: TokenPayload = {
    sub: customer.id,
    sid: sessionId, v: 2,
    exp: Math.floor(Date.now() / 1000) + 60 * 15
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyAccessToken(token: string, secret: string) {
  const segments = token.split(".");
  if (segments.length !== 2) return null;
  const [encodedPayload, signature] = segments;
  if (!encodedPayload || !signature) return null;
  const expectedSignature = sign(encodedPayload, secret);
  if (
    expectedSignature.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
  ) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as TokenPayload;
    return payload.v === 2 && typeof payload.sub === "string" && typeof payload.sid === "string" && Number.isFinite(payload.exp) && payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

export function bearerToken(header: string | string[] | undefined) {
  if (Array.isArray(header)) return bearerToken(header[0]);
  return header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
}

const customerColumns = "id, name, phone, address, password_hash, phone_verified_at, created_at, updated_at";

const loadCustomerPayload = async (
  database: pg.Pool | pg.PoolClient,
  row: CustomerRow,
  _configuredAdminPhones: string[] = []
): Promise<CustomerPayload> => {
  const [roleRows, plumber] = await Promise.all([
    database.query<{ role: AccountRole }>(
      "SELECT role FROM app_account_roles WHERE account_id = $1 AND is_active = true ORDER BY role",
      [row.id]
    ),
    getPlumberProfileByAccount(database, row.id)
  ]);
  const roles = roleRows.rows.map((item) => item.role);
  if (!roles.includes("customer")) roles.unshift("customer");
  const admin = roles.includes("admin") && Boolean(row.phone_verified_at);
  if (!admin && roles.includes("admin")) roles.splice(roles.indexOf("admin"), 1);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    accountType: plumber ? "plumber" : "customer",
    roles,
    isAdmin: admin,
    plumber,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString()
  };
};

export async function registerCustomer(
  pool: pg.Pool,
  payload: {
    name?: string;
    phone?: string;
    address?: string;
    password?: string;
    accountType?: "customer" | "plumber";
    plumberApplication?: PlumberApplicationInput;
    phoneProof?: PhoneProof;
  },
  secret: string,
  _configuredAdminPhones: string[] = []
) {
  const name = payload.name?.trim().slice(0, 200) || "";
  const phone = normalizePhone(payload.phone ?? "");
  const address = payload.address?.trim().slice(0, 500) || null;
  const password = payload.password ?? "";
  const accountType = payload.accountType === "plumber" ? "plumber" : "customer";
  if (!name || !isValidAccountPhone(phone) || password.length < 8 || password.length > 200) {
    throw Object.assign(new Error("Заполните имя, телефон +996 и пароль минимум из 8 символов."), { statusCode: 400 });
  }
  if (accountType === "plumber" && !payload.plumberApplication) {
    throw Object.assign(new Error("Заполните анкету сантехника."), { statusCode: 400 });
  }

  await consumePhoneProof(pool, secret, "register", phone, null, payload.phoneProof);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if ((await client.query("SELECT id FROM app_customers WHERE phone = $1 LIMIT 1", [phone])).rowCount) {
      throw Object.assign(new Error("Пользователь с таким телефоном уже зарегистрирован."), { statusCode: 409 });
    }
    const inserted = await client.query<CustomerRow>(
      `INSERT INTO app_customers (id, name, phone, address, password_hash, phone_verified_at)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING ${customerColumns}`,
      [randomUUID(), name, phone, address, hashPassword(password)]
    );
    const row = inserted.rows[0];
    await client.query(
      `INSERT INTO app_account_roles (account_id, role, is_active) VALUES ($1, 'customer', true)
       ON CONFLICT (account_id, role) DO UPDATE SET is_active = true`,
      [row.id]
    );
    if (accountType === "plumber" && payload.plumberApplication) {
      await createPlumberApplicationRecord(client, row.id, {
        ...payload.plumberApplication,
        fullName: payload.plumberApplication.fullName || name
      });
    }
    await client.query("COMMIT");
    const user = await loadCustomerPayload(pool, row);
    return { session: await issueSession(pool, user, secret), user };
  } catch (error) {
    await client.query("ROLLBACK");
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw Object.assign(new Error("Пользователь с таким телефоном уже зарегистрирован."), { statusCode: 409 });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function loginCustomer(
  pool: pg.Pool,
  payload: { phone?: string; password?: string; phoneProof?: PhoneProof },
  secret: string,
  _configuredAdminPhones: string[] = []
) {
  const phone = normalizePhone(payload.phone ?? "");
  await rateLimit(pool, "login-account", phone, 15, 10 * 60_000);
  const row = await pool.query<CustomerRow>(
    `SELECT ${customerColumns} FROM app_customers WHERE phone = $1 LIMIT 1`,
    [phone]
  );
  const customer = row.rows[0];
  if (!customer || !verifyPassword(payload.password ?? "", customer.password_hash)) {
    throw Object.assign(new Error("Неверный телефон или пароль"), { statusCode: 401 });
  }
  if (!customer.phone_verified_at) {
    await consumePhoneProof(pool, secret, "login", phone, customer.id, payload.phoneProof);
    await pool.query("UPDATE app_customers SET phone_verified_at=now() WHERE id=$1", [customer.id]);
    customer.phone_verified_at = new Date();
  }
  const user = await loadCustomerPayload(pool, customer);
  return { session: await issueSession(pool, user, secret), user };
}

export async function getCustomerProfile(
  pool: pg.Pool,
  customerId: string,
  _configuredAdminPhones: string[] = []
) {
  const row = await pool.query<CustomerRow>(
    `SELECT ${customerColumns} FROM app_customers WHERE id = $1 LIMIT 1`,
    [customerId]
  );
  if (!row.rows[0]) throw Object.assign(new Error("Профиль не найден."), { statusCode: 404 });
  return { user: await loadCustomerPayload(pool, row.rows[0]) };
}

export async function updateCustomerProfile(
  pool: pg.Pool,
  customerId: string,
  payload: { name?: string; phone?: string; address?: string; phoneProof?: PhoneProof },
  _configuredAdminPhones: string[] = [],
  secret = ""
) {
  const name = payload.name?.trim().slice(0, 200) || "Покупатель";
  const phone = normalizePhone(payload.phone ?? "");
  const address = payload.address?.trim().slice(0, 500) || null;
  if (!isValidAccountPhone(phone)) {
    throw Object.assign(new Error("Введите телефон в формате +996 XXX XXX XXX."), { statusCode: 400 });
  }

  const current = await pool.query<CustomerRow>(`SELECT ${customerColumns} FROM app_customers WHERE id=$1`, [customerId]);
  if (!current.rows[0]) fail("Профиль не найден.", 404);
  const changingPhone = current.rows[0].phone !== phone;
  if (changingPhone) await consumePhoneProof(pool, secret, "phone_change", phone, customerId, payload.phoneProof);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (changingPhone) await client.query("UPDATE app_sessions SET revoked_at=now() WHERE account_id=$1", [customerId]);
    const updated = await client.query<CustomerRow>(
      `UPDATE app_customers SET name = $1, phone = $2, address = $3, updated_at = now()
       WHERE id = $4 RETURNING ${customerColumns}`,
      [name, phone, address, customerId]
    );
    if (!updated.rows[0]) throw Object.assign(new Error("Профиль не найден."), { statusCode: 404 });
    await client.query("UPDATE app_plumber_profiles SET full_name = $1, updated_at = now() WHERE account_id = $2", [name, customerId]);
    await client.query("COMMIT");
    return { user: await loadCustomerPayload(pool, updated.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK");
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw Object.assign(new Error("Пользователь с таким телефоном уже зарегистрирован."), { statusCode: 409 });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function hasAdminAccess(pool: pg.Pool, accountId: string, _configuredAdminPhones: string[] = []) {
  const result = await pool.query<{ phone: string; database_admin: boolean }>(
    `SELECT accounts.phone, EXISTS (
       SELECT 1 FROM app_account_roles roles
       WHERE roles.account_id = accounts.id AND roles.role = 'admin' AND roles.is_active = true AND accounts.phone_verified_at IS NOT NULL
     ) AS database_admin
     FROM app_customers accounts WHERE accounts.id = $1 LIMIT 1`,
    [accountId]
  );
  const row = result.rows[0];
  return Boolean(row?.database_admin);
}

const refreshHash = (value: string) => createHash('sha256').update(value).digest('hex');
async function issueSession(database: pg.Pool | pg.PoolClient, user: CustomerPayload, secret: string) {
  const id = randomUUID(); const refreshToken = randomBytes(32).toString('base64url');
  await database.query(`INSERT INTO app_sessions(id,account_id,refresh_hash,expires_at)
    VALUES ($1,$2,$3,now() + interval '30 days')`, [id,user.id,refreshHash(refreshToken)]);
  return { accessToken: createAccessToken(user, secret, id), refreshToken };
}

export async function requireSession(pool: pg.Pool, token: string, secret: string) {
  const payload = verifyAccessToken(token, secret);
  if (!payload) return fail('Войдите в аккаунт.', 401);
  const row = await pool.query(`SELECT 1 FROM app_sessions s JOIN app_customers c ON c.id=s.account_id
    WHERE s.id=$1 AND s.account_id=$2 AND s.revoked_at IS NULL AND s.expires_at>now() AND c.phone_verified_at IS NOT NULL`, [payload.sid,payload.sub]);
  if (!row.rowCount) return fail('Сессия завершена. Войдите снова.', 401);
  return payload.sub;
}

export async function refreshSession(pool: pg.Pool, token: string, secret: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT * FROM app_sessions WHERE refresh_hash=$1 FOR UPDATE`, [refreshHash(token)]);
    const session = result.rows[0];
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) fail('Войдите снова.', 401);
    const row = await client.query<CustomerRow>(`SELECT ${customerColumns} FROM app_customers WHERE id=$1`, [session.account_id]);
    if (!row.rows[0]?.phone_verified_at) fail('Подтвердите номер телефона.', 401);
    // Roles are always reloaded from the database; an old token cannot restore a revoked privilege.
    const user = await loadCustomerPayload(client, row.rows[0]);
    await client.query('UPDATE app_sessions SET revoked_at=now() WHERE id=$1', [session.id]);
    const next = await issueSession(client, user, secret);
    await client.query('COMMIT'); return { user, session: next };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function revokeSession(pool: pg.Pool, token: string, secret: string, refreshToken = "") {
  if (refreshToken) await pool.query('UPDATE app_sessions SET revoked_at=now() WHERE refresh_hash=$1', [refreshHash(refreshToken)]);
  const payload = verifyAccessToken(token, secret);
  if (payload) await pool.query('UPDATE app_sessions SET revoked_at=now() WHERE id=$1 AND account_id=$2', [payload.sid,payload.sub]);
}

export async function resetPassword(pool: pg.Pool, phone: string, password: string, proof: PhoneProof, secret: string) {
  if (password.length < 8 || password.length > 200) fail('Пароль должен содержать от 8 до 200 символов.');
  const result = await pool.query<{id:string}>('SELECT id FROM app_customers WHERE phone=$1', [phone]);
  const id = result.rows[0]?.id;
  if (!id) fail('Не удалось восстановить доступ.', 400);
  await consumePhoneProof(pool, secret, 'password_reset', phone, id, proof);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE app_customers SET password_hash=$1,phone_verified_at=now(),updated_at=now() WHERE id=$2', [hashPassword(password),id]);
    await client.query('UPDATE app_sessions SET revoked_at=now() WHERE account_id=$1', [id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
