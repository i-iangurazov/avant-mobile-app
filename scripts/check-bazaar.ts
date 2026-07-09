import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  adaptCategories,
  adaptOrders,
  adaptProducts,
  deriveCategoriesFromProducts
} from "../src/lib/bazaar/adapters";
import { BAZAAR_ENDPOINTS } from "../src/lib/bazaar/endpoints";

type Env = Record<string, string>;
type Summary = {
  status: number | "network-error";
  ok: boolean;
  shape: string;
  count?: number;
  objectKeys?: string[];
  error?: string;
  note?: string;
};

const loadEnv = () => {
  const env: Env = { ...process.env } as Env;
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return env;
  }

  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!env[key]) {
      env[key] = value;
    }
  }

  return env;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const describeShape = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return `array(${payload.length})`;
  }
  if (payload && typeof payload === "object") {
    return `object(${Object.keys(payload as Record<string, unknown>).slice(0, 8).join(", ") || "no keys"})`;
  }
  return typeof payload;
};

const objectKeys = (items: unknown[]) => {
  const firstObject = items.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  return firstObject ? Object.keys(firstObject).slice(0, 12) : [];
};

const payloadTotal = (payload: unknown) => {
  if (payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).total === "number") {
    return (payload as Record<string, number>).total;
  }

  return null;
};

const readPayload = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const safeGet = async (baseUrl: string, token: string, path: string, normalize: (payload: unknown) => unknown[]): Promise<Summary> => {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    const payload = await readPayload(response);
    const normalized = response.ok ? normalize(payload) : [];
    return {
      status: response.status,
      ok: response.ok,
      shape: describeShape(payload),
      count: normalized.length,
      objectKeys: objectKeys(normalized),
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      status: "network-error",
      ok: false,
      shape: "none",
      error: error instanceof Error ? error.message : "Network error"
    };
  }
};

const safeProbe = async (baseUrl: string, token: string, path: string, method: "GET" | "OPTIONS" = "OPTIONS"): Promise<Summary> => {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    const payload = await readPayload(response);
    const found = response.status !== 404;
    const confirmed = response.ok || [401, 403, 405].includes(response.status);
    return {
      status: response.status,
      ok: confirmed,
      shape: describeShape(payload),
      error: found ? undefined : `Bazaar API endpoint for ${path} was not found/confirmed.`,
      note: confirmed
        ? "Endpoint exists or is protected/method-limited. Confirm exact production method and payload before enabling mutation."
        : undefined
    };
  } catch (error) {
    return {
      status: "network-error",
      ok: false,
      shape: "none",
      error: error instanceof Error ? error.message : "Network error"
    };
  }
};

const printSummary = (label: string, path: string, summary: Summary) => {
  console.log(`${label}: ${path}`);
  console.log(`  reached: ${summary.status !== "network-error" ? "yes" : "no"}`);
  console.log(`  status: ${summary.status}`);
  console.log(`  ok: ${summary.ok ? "yes" : "no"}`);
  console.log(`  shape: ${summary.shape}`);
  if (summary.count !== undefined) {
    console.log(`  normalized count: ${summary.count}`);
  }
  if (summary.objectKeys?.length) {
    console.log(`  normalized object keys: ${summary.objectKeys.join(", ")}`);
  }
  if (summary.error) {
    console.log(`  issue: ${summary.error}`);
  }
  if (summary.note) {
    console.log(`  note: ${summary.note}`);
  }
};

async function main() {
  const env = loadEnv();
  const baseUrl = trimTrailingSlash(env.BAZAAR_API_BASE_URL ?? "");
  const token = env.BAZAAR_API_TOKEN ?? "";
  console.log("Bazaar env:");
  console.log(`  BAZAAR_API_BASE_URL: ${baseUrl ? "present" : "missing"}`);
  console.log(`  BAZAAR_API_TOKEN: ${token ? "present" : "missing"}`);

  if (!baseUrl || !token) {
    console.error("Bazaar API check failed: missing server-side Bazaar env.");
    process.exit(1);
  }

  const products = await safeGet(baseUrl, token, BAZAAR_ENDPOINTS.products, adaptProducts);
  let categories = await safeGet(baseUrl, token, BAZAAR_ENDPOINTS.categories, adaptCategories);

  if (!categories.ok && products.ok) {
    const response = await fetch(`${baseUrl}${BAZAAR_ENDPOINTS.products}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    const payload = await readPayload(response);
    const productsFromPayload = adaptProducts(payload).filter((product) => product.is_available === true);
    const derived = deriveCategoriesFromProducts(productsFromPayload);
    const allProducts = derived.find((category) => category.id === "all-products");
    const fallbackCategories = [
      allProducts,
      ...derived.filter((category) => category.id !== "all-products")
    ].filter(Boolean);

    categories = {
      status: categories.status,
      ok: fallbackCategories.length > 0,
      shape: `${categories.shape}; fallback=products`,
      count: fallbackCategories.length,
      objectKeys: objectKeys(fallbackCategories),
      error: fallbackCategories.length
        ? `Dedicated category endpoint unavailable; using real product category fields only. Product total: ${payloadTotal(payload) ?? "unknown"}.`
        : categories.error
    };
  }

  printSummary("categories", BAZAAR_ENDPOINTS.categories, categories);
  printSummary("products", BAZAAR_ENDPOINTS.products, products);

  let failed = !categories.ok || !products.ok;

  const ordersGet = await safeGet(baseUrl, token, BAZAAR_ENDPOINTS.orders, adaptOrders);
  const ordersPostProbe = await safeProbe(baseUrl, token, BAZAAR_ENDPOINTS.orders);

  printSummary("orders GET endpoint", BAZAAR_ENDPOINTS.orders, ordersGet);
  printSummary("orders POST endpoint probe", BAZAAR_ENDPOINTS.orders, ordersPostProbe);

  console.log("Customer auth/register/profile are handled by the Avantehnik app backend database, not Bazaar API.");
  if (!ordersGet.ok) {
    console.log("Bazaar API endpoint for orders list was not found/confirmed.");
  }
  if (!ordersPostProbe.ok) {
    console.log("Bazaar API endpoint for order creation was not found/confirmed.");
  }

  if (failed) {
    console.error("Bazaar API check failed. Confirm endpoint paths in src/lib/bazaar/endpoints.ts.");
    process.exit(1);
  }

  console.log("Bazaar API check passed.");
}

void main();
