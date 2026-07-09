import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bearerToken,
  getCustomerProfile,
  loginCustomer,
  registerCustomer,
  updateCustomerProfile,
  verifyAccessToken
} from "./server/auth";
import { createPool, ensureSchema } from "./server/db";
import { loadEnv } from "./server/env";

const env = loadEnv();
const port = Number(env.BAZAAR_PROXY_PORT || 8787);
const host = env.BAZAAR_PROXY_HOST || "0.0.0.0";
const bazaarBaseUrl = (env.BAZAAR_API_BASE_URL || "https://www.bazaar.kg/api/bazaar/v1").replace(/\/+$/, "");
const bazaarToken = env.BAZAAR_API_TOKEN || "";
const databaseUrl = env.DATABASE_URL || "";
const configuredAuthSecret =
  env.AUTH_TOKEN_SECRET && !env.AUTH_TOKEN_SECRET.startsWith("replace_with") ? env.AUTH_TOKEN_SECRET : "";
const authTokenSecret = configuredAuthSecret || env.BAZAAR_API_TOKEN || "avantehnik-local-dev-secret";
const databasePool = createPool(databaseUrl);

const allowedPrefixes = [
  "/products",
  "/categories",
  "/orders",
  "/auth/login",
  "/auth/register",
  "/profile",
  "/image-search"
];

const blockedPathParts = [
  "stock",
  "warehouse",
  "inventory",
  "adjust",
  "correction",
  "oprihod",
  "приход",
  "коррект",
  "склад"
];

const getCorsHeaders = (req: IncomingMessage) => ({
  "Access-Control-Allow-Origin": req.headers.origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Access-Control-Request-Private-Network",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin, Access-Control-Request-Private-Network"
});

const sendJson = (req: IncomingMessage, res: ServerResponse, status: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...getCorsHeaders(req),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
};

const readJsonBody = async (req: IncomingMessage) => {
  const body = await readBody(req);
  if (!body.length) {
    return {};
  }

  try {
    return JSON.parse(body.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error("Некорректный JSON запрос."), {
      statusCode: 400
    });
  }
};

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const isPathAllowed = (path: string) => {
  const lower = decodeURIComponent(path).toLowerCase();
  if (blockedPathParts.some((part) => lower.includes(part))) {
    return false;
  }
  return allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

const isAppRoute = (path: string) =>
  path === "/auth/login" || path === "/auth/register" || path === "/profile";

const requireDatabase = () => {
  if (!databasePool) {
    throw Object.assign(new Error("App database is not configured. Set DATABASE_URL."), {
      statusCode: 503
    });
  }
  return databasePool;
};

const requireCustomerId = (req: IncomingMessage) => {
  const token = bearerToken(req.headers.authorization);
  const payload = verifyAccessToken(token, authTokenSecret);
  if (!payload?.sub) {
    throw Object.assign(new Error("Войдите в аккаунт."), {
      statusCode: 401
    });
  }
  return payload.sub;
};

const sendError = (req: IncomingMessage, res: ServerResponse, error: unknown) => {
  const status =
    typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  const message = error instanceof Error ? error.message : "Сервис временно недоступен. Попробуйте позже.";

  sendJson(req, res, status, { error: message });
};

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const path = requestUrl.pathname;
  const shouldLog = env.NODE_ENV !== "production";
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    res.writeHead(204, getCorsHeaders(req));
    res.end();
    if (shouldLog) {
      console.log(`${req.method} ${path} -> 204 ${Date.now() - startedAt}ms`);
    }
    return;
  }

  if (path === "/health") {
    sendJson(req, res, 200, {
      ok: Boolean(bazaarBaseUrl && bazaarToken && databasePool),
      bazaarBaseUrl: bazaarBaseUrl ? "present" : "missing",
      bazaarToken: bazaarToken ? "present" : "missing",
      database: databasePool ? "present" : "missing"
    });
    if (shouldLog) {
      console.log(`${req.method} ${path} -> 200 ${Date.now() - startedAt}ms`);
    }
    return;
  }

  if (isAppRoute(path)) {
    try {
      const pool = requireDatabase();

      if (path === "/auth/register" && req.method === "POST") {
        const payload = await readJsonBody(req);
        const result = await registerCustomer(
          pool,
          {
            name: typeof payload.name === "string" ? payload.name : undefined,
            phone: typeof payload.phone === "string" ? payload.phone : undefined,
            address: typeof payload.address === "string" ? payload.address : undefined,
            password: typeof payload.password === "string" ? payload.password : undefined
          },
          authTokenSecret
        );
        sendJson(req, res, 201, result);
        if (shouldLog) {
          console.log(`${req.method} ${path} -> 201 ${Date.now() - startedAt}ms`);
        }
        return;
      }

      if (path === "/auth/login" && req.method === "POST") {
        const payload = await readJsonBody(req);
        const result = await loginCustomer(
          pool,
          {
            phone: typeof payload.phone === "string" ? payload.phone : undefined,
            password: typeof payload.password === "string" ? payload.password : undefined
          },
          authTokenSecret
        );
        sendJson(req, res, 200, result);
        if (shouldLog) {
          console.log(`${req.method} ${path} -> 200 ${Date.now() - startedAt}ms`);
        }
        return;
      }

      if (path === "/profile" && req.method === "GET") {
        const result = await getCustomerProfile(pool, requireCustomerId(req));
        sendJson(req, res, 200, result);
        if (shouldLog) {
          console.log(`${req.method} ${path} -> 200 ${Date.now() - startedAt}ms`);
        }
        return;
      }

      if (path === "/profile" && ["PATCH", "PUT"].includes(req.method || "")) {
        const customerId = requireCustomerId(req);
        const payload = await readJsonBody(req);
        const result = await updateCustomerProfile(pool, customerId, {
          name: typeof payload.name === "string" ? payload.name : undefined,
          phone: typeof payload.phone === "string" ? payload.phone : undefined,
          address: typeof payload.address === "string" ? payload.address : undefined
        });
        sendJson(req, res, 200, result);
        if (shouldLog) {
          console.log(`${req.method} ${path} -> 200 ${Date.now() - startedAt}ms`);
        }
        return;
      }

      sendJson(req, res, 405, { error: "Метод не поддерживается." });
      if (shouldLog) {
        console.log(`${req.method} ${path} -> 405 ${Date.now() - startedAt}ms`);
      }
      return;
    } catch (error) {
      if (env.NODE_ENV !== "production") {
        console.error("[app-api:error]", error);
      }
      sendError(req, res, error);
      if (shouldLog) {
        const status =
          typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
            ? error.statusCode
            : 500;
        console.log(`${req.method} ${path} -> ${status} ${Date.now() - startedAt}ms`);
      }
      return;
    }
  }

  if (!bazaarBaseUrl || !bazaarToken) {
    sendJson(req, res, 500, {
      error: "Bazaar proxy is missing BAZAAR_API_BASE_URL or BAZAAR_API_TOKEN."
    });
    if (shouldLog) {
      console.log(`${req.method} ${path} -> 500 ${Date.now() - startedAt}ms`);
    }
    return;
  }

  if (!isPathAllowed(path)) {
    sendJson(req, res, 404, {
      error: "This Bazaar proxy route is not allowed for the customer app."
    });
    if (shouldLog) {
      console.log(`${req.method} ${path} -> 404 ${Date.now() - startedAt}ms`);
    }
    return;
  }

  if (path === "/image-search") {
    sendJson(req, res, 501, {
      error: "Image search endpoint is not connected yet."
    });
    if (shouldLog) {
      console.log(`${req.method} ${path} -> 501 ${Date.now() - startedAt}ms`);
    }
    return;
  }

  try {
    const body = ["GET", "HEAD"].includes(req.method || "GET") ? undefined : await readBody(req);
    const response = await fetch(`${bazaarBaseUrl}${path}${requestUrl.search}`, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "Content-Type": req.headers["content-type"] || "application/json",
        Authorization: `Bearer ${bazaarToken}`
      },
      body
    });
    const responseBody = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, {
      ...getCorsHeaders(req),
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "Content-Length": responseBody.byteLength
    });
    res.end(responseBody);
    if (shouldLog) {
      console.log(`${req.method} ${path} -> ${response.status} ${Date.now() - startedAt}ms`);
    }
  } catch (error) {
    if (env.NODE_ENV !== "production") {
      console.error("[bazaar-proxy:error]", error);
    }
    sendJson(req, res, 502, {
      error: "Bazaar proxy could not reach Bazaar API."
    });
    if (shouldLog) {
      console.log(`${req.method} ${path} -> 502 ${Date.now() - startedAt}ms`);
    }
  }
});

const startServer = async () => {
  if (databasePool) {
    await ensureSchema(databasePool);
  }

  server.listen(port, host, () => {
    console.log(`Avantehnik Bazaar proxy listening on http://${host}:${port}`);
    console.log(`BAZAAR_API_BASE_URL: ${bazaarBaseUrl ? "present" : "missing"}`);
    console.log(`BAZAAR_API_TOKEN: ${bazaarToken ? "present" : "missing"}`);
    console.log(`DATABASE_URL: ${databasePool ? "present" : "missing"}`);
  });
};

void startServer().catch((error) => {
  console.error("[server:start]", error);
  process.exit(1);
});
