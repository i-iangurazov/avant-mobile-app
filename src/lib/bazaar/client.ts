import {loadCompleteCatalog,orderedProductPage} from "./completeCatalog";
import type { Category, Product } from "../../types";
import { apiBaseUrl } from "../config/env";
import { normalizeApiError } from "../errors/normalizeApiError";
import {
  adaptCategories,
  adaptProduct,
  adaptProducts,
  deriveCategoriesFromProducts
} from "./adapters";
import { BAZAAR_ENDPOINTS } from "./endpoints";
import type { BazaarQueryParams } from "./types";

type BazaarClientConfig = {
  baseUrl: string;
  token?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  usesProxy?: boolean;
};

type ProductQuery = {
  categoryId?: string;
  search?: string;
  inStock?: boolean;
  withPrice?: boolean;
  sort?: "name" | "price_asc" | "price_desc";
  limit?: number;
};

type ProductPageQuery = ProductQuery & {
  page?: number;
  pageSize?: number;
};

export type ProductPageResult = {
  products: Product[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const toQueryString = (params?: BazaarQueryParams) => {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const DEFAULT_PRODUCTS_PAGE_SIZE = 100;

const getPayloadTotal = (payload: unknown) => {
  if (isRecord(payload) && typeof payload.total === "number") {
    return payload.total;
  }

  return null;
};

const categoryById = (categoryId?: string) =>
  categoryId && categoryId !== "all-products" ? { id: categoryId } : null;

const getAllProductsFromApi = async (params?: BazaarQueryParams, stopWhenVisibleCount?: number) => {
  const pageSize = Number(params?.pageSize ?? DEFAULT_PRODUCTS_PAGE_SIZE);
  const firstPayload = await bazaarClient.getProductsRaw({ ...params, page: 1, pageSize });
  const products = adaptProducts(firstPayload);
  const total = getPayloadTotal(firstPayload);
  const totalPages = total ? Math.ceil(total / pageSize) : 1;
  const maxPages = Math.min(totalPages, 30);

  if (stopWhenVisibleCount && products.length >= stopWhenVisibleCount) {
    return products;
  }

  for (let page = 2; page <= maxPages; page += 1) {
    const payload = await bazaarClient.getProductsRaw({ ...params, page, pageSize });
    products.push(...adaptProducts(payload));
    if (stopWhenVisibleCount && products.length >= stopWhenVisibleCount) {
      break;
    }
  }

  return products;
};

const sortProducts = (products: Product[], sort: ProductQuery["sort"] = "name") => {
  const sorted = [...products];

  if (sort === "price_asc") {
    return sorted.sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));
  }

  if (sort === "price_desc") {
    return sorted.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  }

  return sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
};

const productMatchesQuery = (product: Product, query: Pick<ProductQuery, "inStock" | "withPrice">) => {
  if (query.inStock && !(product.inStock === true || (product.stock_quantity ?? 0) > 0)) {
    return false;
  }

  if (query.withPrice && (product.price === null || product.price === undefined)) {
    return false;
  }

  return true;
};

export class BazaarApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "BazaarApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class BazaarClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly usesProxy: boolean;

  constructor({ baseUrl, token = "", fetcher = fetch, timeoutMs = 15_000, usesProxy = false }: BazaarClientConfig) {
    this.baseUrl = trimTrailingSlash(baseUrl);
    this.token = token;
    this.fetcher = (input, init) => fetcher.call(globalThis, input, init);
    this.timeoutMs = timeoutMs;
    this.usesProxy = usesProxy;
  }

  async request<T>(path: string, init: RequestInit = {}) {
    if (!this.baseUrl) {
      throw new Error("Не настроен сервер приложения. Укажите EXPO_PUBLIC_API_URL.");
    }

    if (!this.usesProxy && !this.token) {
      throw new Error(
        "Не настроен доступ к серверу приложения. Запустите backend и укажите EXPO_PUBLIC_API_URL."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...init.headers
        }
      });

      const text = await response.text();
      const payload = text ? this.parseJson(text) : null;

      if (!response.ok) {
        throw new BazaarApiError(
          response.status,
          this.getErrorMessage(payload) || `Запрос к серверу завершился ошибкой ${response.status}`,
          payload
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof BazaarApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Сервис временно недоступен. Попробуйте позже.");
      }

      throw new Error(normalizeApiError(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  async getCategoriesRaw() {
    return this.request<unknown>(BAZAAR_ENDPOINTS.categories);
  }

  async getProductsRaw(params?: BazaarQueryParams) {
    return this.request<unknown>(`${BAZAAR_ENDPOINTS.products}${toQueryString(params)}`);
  }

  async getProductRaw(id: string) {
    return this.request<unknown>(BAZAAR_ENDPOINTS.product(id));
  }

  private parseJson(text: string) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private getErrorMessage(payload: unknown) {
    if (!payload) {
      return "";
    }

    if (typeof payload === "string") {
      return payload;
    }

    if (typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      const message = record.message ?? record.error ?? record.detail ?? record.details;
      return typeof message === "string" ? message : "";
    }

    return "";
  }
}

export const bazaarClient = new BazaarClient({
  baseUrl: apiBaseUrl,
  usesProxy: true
});

const isMissingEndpoint = (error: unknown) =>
  error instanceof BazaarApiError && [404, 405].includes(error.status);

export async function getCategories(): Promise<Category[]> {
  try {
    const payload = await bazaarClient.getCategoriesRaw();
    const categories = adaptCategories(payload);
    if (categories.length) {
      return categories;
    }
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw new Error(normalizeApiError(error));
    }
  }

  const productsPayload = await bazaarClient.getProductsRaw({ page: 1, pageSize: DEFAULT_PRODUCTS_PAGE_SIZE });
  const productDerivedCategories = deriveCategoriesFromProducts(productsPayload);
  const allProducts = productDerivedCategories.find((category) => category.id === "all-products") ?? {
    id: "all-products",
    name: "Все товары",
    slug: "all-products",
    imageUrl: null,
    image_url: null,
    productsCount: 0,
    product_count: 0
  };

  return productDerivedCategories.length ? productDerivedCategories : [allProducts];
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const category = categoryById(query.categoryId);
  const shouldStopEarly = query.limit && !query.search?.trim() && (!query.categoryId || query.categoryId === "all-products");

  if (query.limit && (query.inStock || query.withPrice) && !query.search?.trim() && (!query.categoryId || query.categoryId === "all-products")) {
    const pageSize = DEFAULT_PRODUCTS_PAGE_SIZE;
    const visibleProducts: Product[] = [];
    let total: number | null = null;

    for (let page = 1; page <= 20; page += 1) {
      const payload = await bazaarClient.getProductsRaw({ page, pageSize });
      total = total ?? getPayloadTotal(payload);
      visibleProducts.push(...adaptProducts(payload).filter((product) => productMatchesQuery(product, query)));

      if (visibleProducts.length >= query.limit || (total !== null && page * pageSize >= total)) {
        break;
      }
    }

    return sortProducts(visibleProducts, query.sort).slice(0, query.limit);
  }

  let products = await getAllProductsFromApi(
    {
      pageSize: DEFAULT_PRODUCTS_PAGE_SIZE,
      search: query.search?.trim() ?? undefined
    },
    shouldStopEarly ? query.limit : undefined
  );

  if (query.categoryId && query.categoryId !== "all-products") {
    products = category
      ? products.filter((product) => product.category_id === category.id)
      : [];
  }

  if (query.search?.trim()) {
    const normalized = query.search.trim().toLowerCase();
    products = products.filter((product) =>
      [
        product.name,
        product.sku,
        product.brand,
        product.description,
        product.category?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }

  products = products.filter((product) => productMatchesQuery(product, query));

  return sortProducts(products, query.sort).slice(0, query.limit ?? products.length);
}

let catalogSnapshot: {expires:number;promise:Promise<Product[]>}|null=null;
export async function getProductsPage(query: ProductPageQuery = {}): Promise<ProductPageResult> {
  if(!catalogSnapshot || catalogSnapshot.expires<Date.now()) {
    const promise=loadCompleteCatalog(page=>bazaarClient.getProductsRaw({page,pageSize:DEFAULT_PRODUCTS_PAGE_SIZE}));
    catalogSnapshot={expires:Date.now()+60_000,promise};
    promise.catch(()=>{if(catalogSnapshot?.promise===promise)catalogSnapshot=null;});
  }
  return orderedProductPage(await catalogSnapshot.promise,{...query,page:Math.max(1,Math.floor(query.page||1)),pageSize:Math.max(1,Math.min(100,Math.floor(query.pageSize||100)))});
}

export async function getProductById(productId: string): Promise<Product> {
  const payload = await bazaarClient.getProductRaw(productId);
  const products = adaptProducts(payload);
  const directProduct = products.find((item) => item.id === productId);

  if (directProduct) {
    return directProduct;
  }

  const singleProduct = adaptProduct(payload);

  if (singleProduct && singleProduct.id === productId) {
    return singleProduct;
  }

  const pageSize = DEFAULT_PRODUCTS_PAGE_SIZE;

  for (let page = 1; page <= 30; page += 1) {
    const pagePayload = await bazaarClient.getProductsRaw({ page, pageSize });
    const total = getPayloadTotal(pagePayload);
    const product = adaptProducts(pagePayload).find((item) => item.id === productId);

    if (product) {
      return product;
    }

    if (total !== null && page * pageSize >= total) {
      break;
    }
  }

  throw new Error("Товар не найден.");
}

export async function searchProducts(search: string): Promise<Product[]> {
  return getProducts({ search, sort: "name" });
}
