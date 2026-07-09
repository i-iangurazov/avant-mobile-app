import type { CartItemWithProduct, Category, OrderDetail, OrderListItem, Product } from "../../types";
import { bazaarProxyBaseUrl } from "../config/env";
import { normalizeApiError } from "../errors/normalizeApiError";
import { normalizePhone } from "../formatters";
import {
  adaptCategories,
  adaptOrder,
  adaptOrderDetail,
  adaptOrders,
  adaptProduct,
  adaptProducts,
  deriveCategoriesFromProducts
} from "./adapters";
import { BAZAAR_ENDPOINTS } from "./endpoints";
import type {
  BazaarCustomer,
  BazaarCustomerSession,
  BazaarQueryParams,
  LoginCustomerPayload,
  RegisterCustomerPayload,
  UpdateCustomerProfilePayload
} from "./types";

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

export type BazaarCreateOrderPayload = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: "pickup" | "delivery";
  storeId?: string | null;
  deliveryAddress?: string | null;
  comment?: string | null;
  items: CartItemWithProduct[];
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

const read = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const readRecord = (record: Record<string, unknown>, keys: string[]) => {
  const value = read(record, keys);
  return isRecord(value) ? value : null;
};

const readString = (record: Record<string, unknown>, keys: string[], fallback = "") => {
  const value = read(record, keys);
  return value === undefined ? fallback : String(value);
};

const explicitMissingEndpointMessage = (name: string) =>
  `Серверный endpoint для ${name} не настроен. Требуется подтвердить backend-маршрут для этого действия.`;

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

const adaptCustomerSession = (
  payload: unknown,
  fallback: { phone: string; name?: string; address?: string | null }
): BazaarCustomerSession => {
  const root = isRecord(payload) ? payload : {};
  const data = readRecord(root, ["data"]) ?? root;
  const sessionRecord = readRecord(data, ["session", "auth", "token"]) ?? data;
  const userRecord = readRecord(data, ["user", "customer", "profile", "client"]) ?? data;
  const accessToken = readString(sessionRecord, ["accessToken", "access_token", "token", "jwt"], "");
  const refreshToken = readString(sessionRecord, ["refreshToken", "refresh_token"], "");
  const id =
    readString(userRecord, ["id", "uuid", "customer_id", "customerId", "user_id", "phone"], "") ||
    fallback.phone;

  const user: BazaarCustomer = {
    id,
    name: readString(userRecord, ["name", "full_name", "fullName"], fallback.name || "Покупатель"),
    phone: readString(userRecord, ["phone", "phone_number", "phoneNumber"], fallback.phone),
    address: readString(userRecord, ["address", "delivery_address", "deliveryAddress"], fallback.address || "")
  };

  if (!user.phone && !accessToken) {
    throw new Error("Сервер авторизации вернул неподдерживаемый формат ответа.");
  }

  return {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    user,
    raw: payload
  };
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
      throw new Error("Не настроен сервер приложения. Укажите EXPO_PUBLIC_BAZAAR_PROXY_URL.");
    }

    if (!this.usesProxy && !this.token) {
      throw new Error(
        "Не настроен доступ к серверу приложения. Запустите backend proxy и укажите EXPO_PUBLIC_BAZAAR_PROXY_URL."
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

  async getOrdersRaw(params?: BazaarQueryParams) {
    return this.request<unknown>(`${BAZAAR_ENDPOINTS.orders}${toQueryString(params)}`);
  }

  async getOrderRaw(id: string) {
    return this.request<unknown>(BAZAAR_ENDPOINTS.order(id));
  }

  async createOrderRaw(payload: unknown) {
    return this.request<unknown>(BAZAAR_ENDPOINTS.orders, {
      method: "POST",
      body: JSON.stringify(payload)
    });
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
  baseUrl: bazaarProxyBaseUrl,
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

  return sortProducts(products, query.sort).slice(0, query.limit ?? products.length);
}

export async function getProductsPage(query: ProductPageQuery = {}): Promise<ProductPageResult> {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(query.pageSize) || DEFAULT_PRODUCTS_PAGE_SIZE)));
  const payload = await bazaarClient.getProductsRaw({
    page,
    pageSize,
    search: query.search?.trim() ?? undefined
  });
  const total = getPayloadTotal(payload);
  let products = adaptProducts(payload);

  if (query.categoryId && query.categoryId !== "all-products") {
    products = products.filter((product) => product.category_id === query.categoryId);
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

  return {
    products: sortProducts(products, query.sort),
    page,
    pageSize,
    total,
    hasMore: total !== null ? page * pageSize < total : products.length >= pageSize
  };
}

export async function getProductById(productId: string): Promise<Product> {
  const payload = await bazaarClient.getProductRaw(productId);
  const products = adaptProducts(payload);
  const product = products.find((item) => item.id === productId) ?? products[0] ?? adaptProduct(payload);

  if (!product || product.id === "unknown-product") {
    throw new Error("Товар не найден.");
  }

  return product;
}

export async function searchProducts(search: string): Promise<Product[]> {
  return getProducts({ search, sort: "name" });
}

export async function getOrders(query?: { phone?: string | null }): Promise<OrderListItem[]> {
  try {
    const payload = await bazaarClient.getOrdersRaw({ phone: query?.phone ?? undefined });
    const orders = adaptOrders(payload);
    const requestedPhone = query?.phone ? normalizePhone(query.phone) : "";

    if (!requestedPhone) {
      return orders;
    }

    const detailedOrders = await Promise.all(
      orders.map(async (order) => {
        try {
          return await getOrderById(order.id);
        } catch (error) {
          if (__DEV__) {
            console.warn("Could not load order detail for user filter", order.id, error);
          }
          return null;
        }
      })
    );

    return detailedOrders.filter((order): order is OrderDetail =>
      Boolean(order && normalizePhone(order.customer_phone) === requestedPhone)
    );
  } catch (error) {
    if (isMissingEndpoint(error)) {
      throw new Error(explicitMissingEndpointMessage("orders list"));
    }
    throw new Error(normalizeApiError(error));
  }
}

export async function getOrderById(orderId: string): Promise<OrderDetail> {
  try {
    const payload = await bazaarClient.getOrderRaw(orderId);
    return adaptOrderDetail(payload);
  } catch (error) {
    if (isMissingEndpoint(error)) {
      throw new Error(explicitMissingEndpointMessage("order detail"));
    }
    throw new Error(normalizeApiError(error));
  }
}

export async function createOrder(payload: BazaarCreateOrderPayload): Promise<OrderListItem> {
  const lines = payload.items
    .filter((item) => item.product_id)
    .map((item) => ({
      productId: item.product_id,
      qty: Math.max(1, Math.floor(Number(item.quantity) || 1))
    }));

  if (!lines.length) {
    throw new Error("Корзина пуста.");
  }

  const orderPayload = {
    externalId: `AVANTEHNIK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerAddress: payload.deliveryMethod === "delivery"
      ? payload.deliveryAddress ?? undefined
      : undefined,
    comment: [
      payload.deliveryMethod === "pickup" ? "Самовывоз" : "Доставка",
      payload.storeId ? `Магазин: ${payload.storeId}` : null,
      payload.deliveryAddress ? `Адрес: ${payload.deliveryAddress}` : null,
      payload.comment
    ].filter(Boolean).join(". "),
    lines
  };

  try {
    const response = await bazaarClient.createOrderRaw(orderPayload);
    return adaptOrder(response);
  } catch (error) {
    if (isMissingEndpoint(error)) {
      throw new Error(explicitMissingEndpointMessage("order creation"));
    }
    throw new Error(normalizeApiError(error, "Не удалось оформить заказ. Менеджер поможет уточнить наличие."));
  }
}

export async function loginCustomer(payload: LoginCustomerPayload) {
  try {
    const response = await bazaarClient.request<unknown>(BAZAAR_ENDPOINTS.login, {
      method: "POST",
      body: JSON.stringify({
        phone: payload.phone,
        password: payload.password
      })
    });
    return adaptCustomerSession(response, { phone: payload.phone });
  } catch (error) {
    if (isMissingEndpoint(error)) {
      throw new Error(explicitMissingEndpointMessage("login"));
    }
    throw new Error(normalizeApiError(error));
  }
}

export async function registerCustomer(payload: RegisterCustomerPayload) {
  try {
    const response = await bazaarClient.request<unknown>(BAZAAR_ENDPOINTS.register, {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        address: payload.address,
        password: payload.password
      })
    });
    return adaptCustomerSession(response, payload);
  } catch (error) {
    if (isMissingEndpoint(error)) {
      throw new Error(explicitMissingEndpointMessage("registration"));
    }
    throw new Error(normalizeApiError(error));
  }
}

export async function getProfileFromBazaar(session: BazaarCustomerSession): Promise<BazaarCustomer> {
  try {
    const response = await bazaarClient.request<unknown>(BAZAAR_ENDPOINTS.profile, {
      headers: session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined
    });
    return adaptCustomerSession(response, session.user).user;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return session.user;
    }
    throw new Error(normalizeApiError(error));
  }
}

export async function updateProfileInBazaar(
  payload: UpdateCustomerProfilePayload,
  accessToken?: string | null
): Promise<BazaarCustomer> {
  try {
    const response = await bazaarClient.request<unknown>(BAZAAR_ENDPOINTS.profile, {
      method: "PATCH",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        address: payload.address
      })
    });
    return adaptCustomerSession(response, payload).user;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      throw new Error(explicitMissingEndpointMessage("profile update"));
    }
    throw new Error(normalizeApiError(error));
  }
}
