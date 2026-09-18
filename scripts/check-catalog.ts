import { BAZAAR_ENDPOINTS } from "../src/lib/bazaar/endpoints";
import { loadEnv } from "./server/env";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const records = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    for (const key of ["data", "items", "results", "products", "categories"]) {
      if (Array.isArray(root[key])) {
        return records(root[key]);
      }
    }
  }
  return [];
};

const request = async (baseUrl: string, token: string, path: string) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, payload };
};

async function main() {
  const env = loadEnv();
  const baseUrl = trimTrailingSlash(env.BAZAAR_API_BASE_URL || "");
  const token = env.BAZAAR_API_TOKEN || "";
  console.log(`Catalog URL: ${baseUrl ? "present" : "missing"}`);
  console.log(`Catalog token: ${token ? "present" : "missing"}`);

  if (!baseUrl || !token) {
    throw new Error("Read-only catalog credentials are missing.");
  }

  const productsResult = await request(baseUrl, token, BAZAAR_ENDPOINTS.products);
  if (!productsResult.response.ok) {
    throw new Error(`Catalog products request failed with HTTP ${productsResult.response.status}.`);
  }
  const products = records(productsResult.payload);
  console.log(`Products: ${products.length}`);

  const categoriesResult = await request(baseUrl, token, BAZAAR_ENDPOINTS.categories);
  const discoveredCategories = categoriesResult.response.ok
    ? records(categoriesResult.payload)
    : [...new Set(products.map((product) => {
        const category = product.category;
        if (category && typeof category === "object") {
          const record = category as Record<string, unknown>;
          return String(record.id || record.name || "");
        }
        return String(product.category_id || product.categoryId || "");
      }).filter(Boolean))];
  const categories = discoveredCategories.length ? discoveredCategories : products.length ? ["all-products"] : [];
  console.log(`Categories: ${categories.length}${categoriesResult.response.ok ? "" : discoveredCategories.length ? " (derived from products)" : " (all-products fallback)"}`);

  if (!products.length || !categories.length) {
    throw new Error("Catalog returned no usable products or categories.");
  }
  console.log("Read-only catalog check passed. No write endpoint was called.");
}

void main().catch((error) => {
  console.error("Catalog check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
