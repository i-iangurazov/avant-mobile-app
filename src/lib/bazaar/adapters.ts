import type {
  AppCategory,
  AppOrder,
  AppProduct,
  Category,
  FulfillmentMethod,
  OrderDetail,
  OrderItem,
  OrderListItem,
  OrderStatus,
  OrderStatusEvent,
  Product
} from "../../types";
import { statusLabels } from "../formatters";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const read = (record: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
};

const readString = (record: UnknownRecord, keys: string[], fallback = "") => {
  const value = read(record, keys);
  return value === undefined ? fallback : String(value);
};

const readNullableString = (record: UnknownRecord, keys: string[]) => {
  const value = read(record, keys);
  return value === undefined ? null : String(value);
};

const readNumber = (record: UnknownRecord, keys: string[]) => {
  const value = read(record, keys);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const readBoolean = (record: UnknownRecord, keys: string[]) => {
  const value = read(record, keys);

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (["true", "1", "yes", "available", "in_stock", "в наличии"].includes(lower)) {
      return true;
    }
    if (["false", "0", "no", "unavailable", "out_of_stock", "нет в наличии"].includes(lower)) {
      return false;
    }
  }

  return null;
};

const normalizeArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidates = [
    payload.data,
    payload.items,
    payload.results,
    payload.categories,
    payload.products,
    payload.orders
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (isRecord(candidate)) {
      const nested = normalizeArray(candidate);
      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
};

const normalizeImageUrl = (record: UnknownRecord) => {
  const direct = readNullableString(record, [
    "imageUrl",
    "image_url",
    "photo",
    "photo_url",
    "picture",
    "picture_url",
    "thumbnail",
    "thumbnail_url",
    "main_image",
    "mainImage"
  ]);

  if (direct) {
    return direct;
  }

  const images = read(record, ["images", "photos", "pictures"]);
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    if (typeof first === "string") {
      return first;
    }
    if (isRecord(first)) {
      return readNullableString(first, ["url", "src", "image_url", "imageUrl"]);
    }
  }

  return null;
};

const formatPriceLabel = (price: number | null, fallback?: string | null) => {
  if (fallback) {
    return fallback;
  }

  if (price === null) {
    return "Цена уточняется";
  }

  return `${price.toLocaleString("ru-RU")} сом`;
};

const normalizePrice = (price: number | null) => {
  if (price === null || price <= 0) {
    return null;
  }

  return price;
};

const normalizeAvailability = (record: UnknownRecord) => {
  const explicit = readNullableString(record, [
    "availability_status",
    "availabilityStatus",
    "stock_status",
    "stockStatus",
    "status"
  ]);
  const lower = explicit?.toLowerCase() ?? "";
  const quantity = readNumber(record, [
    "stockQty",
    "pcs",
    "quantity",
    "stock",
    "stock_quantity",
    "balance",
    "available_quantity"
  ]);
  const inStock = readBoolean(record, ["inStock", "in_stock", "is_available", "available"]);

  if (inStock === true || (quantity !== null && quantity > 0) || lower.includes("in_stock") || lower.includes("available")) {
    return {
      status: "in_stock",
      label: "В наличии",
      inStock: true
    };
  }

  if (lower.includes("preorder") || lower.includes("order") || lower.includes("под заказ")) {
    return {
      status: "preorder",
      label: "Уточнить наличие",
      inStock: false
    };
  }

  if (inStock === false || quantity === 0 || lower.includes("out")) {
    return {
      status: "out_of_stock",
      label: "Нет в наличии",
      inStock: false
    };
  }

  return {
    status: "out_of_stock",
    label: readNullableString(record, ["availabilityLabel", "availability_label"]) ?? "Уточнить наличие",
    inStock: null
  };
};

const normalizeOrderStatus = (value: unknown): OrderStatus => {
  const status = String(value || "created").toLowerCase();
  if (status === "new") {
    return "created";
  }
  if (status === "ready") {
    return "ready_for_pickup";
  }
  if (status === "delivery") {
    return "on_the_way";
  }
  if (status === "canceled") {
    return "cancelled";
  }
  return status;
};

const unwrapOrderRecord = (value: unknown) => {
  const record = isRecord(value) ? value : {};
  return isRecord(record.order) ? record.order : record;
};

const categorySortIndex = (categoryId: string) => {
  if (categoryId === "all-products") {
    return -1;
  }
  return 1;
};

export function adaptCategory(value: unknown): Category {
  const record = isRecord(value) ? value : {};
  const id = readString(record, ["id", "uuid", "category_id", "categoryId", "slug"], "unknown-category");
  const imageUrl = normalizeImageUrl(record);
  const productsCount = readNumber(record, ["productsCount", "products_count", "product_count", "count"]);
  const category: AppCategory = {
    id,
    name: readString(record, ["name", "title", "label"], "Категория"),
    slug: readNullableString(record, ["slug", "code"]) ?? undefined,
    imageUrl,
    productsCount
  };

  return {
    ...category,
    image_url: imageUrl,
    product_count: productsCount
  };
}

export function adaptCategories(payload: unknown) {
  return normalizeArray(payload).map(adaptCategory);
}

export function deriveCategoriesFromProducts(payload: unknown): Category[] {
  const products = adaptProducts(payload);
  const groups = new Map<string, Category>();
  const total = isRecord(payload) && typeof payload.total === "number" ? payload.total : products.length;

  groups.set("all-products", {
    id: "all-products",
    name: "Все товары",
    slug: "all-products",
    imageUrl: null,
    image_url: null,
    productsCount: total,
    product_count: total
  });

  for (const product of products) {
    const categoryId = product.category?.id ?? product.category_id;
    const categoryName = product.category?.name;

    if (!categoryId || !categoryName || categoryId === "all-products") {
      continue;
    }

    const current = groups.get(categoryId);
    groups.set(categoryId, {
      id: categoryId,
      name: categoryName,
      slug: product.category?.slug,
      imageUrl: null,
      image_url: null,
      productsCount: (current?.productsCount ?? 0) + 1,
      product_count: (current?.product_count ?? 0) + 1
    });
  }

  return [...groups.values()].sort((a, b) => {
    const order = categorySortIndex(a.id) - categorySortIndex(b.id);
    return order || a.name.localeCompare(b.name, "ru");
  });
}

export function adaptProduct(value: unknown): Product {
  const record = isRecord(value) ? value : {};
  const categoryRecord = isRecord(record.category) ? record.category : null;
  const id = readString(record, ["id", "uuid", "product_id", "productId", "sku"], "unknown-product");
  const explicitCategoryId =
    readNullableString(record, ["categoryId", "category_id"]) ??
    (categoryRecord ? readNullableString(categoryRecord, ["id", "uuid", "slug"]) : null);
  const name = readString(record, ["name", "title", "product_name", "productName"], "Товар");
  const sku = readNullableString(record, ["sku", "article", "vendor_code", "code"]);
  const description = readNullableString(record, ["description", "body", "text"]);
  const brand = readNullableString(record, ["brand", "manufacturer", "producer"]);
  const category =
    categoryRecord
      ? {
          id: readString(categoryRecord, ["id", "uuid", "slug"], explicitCategoryId ?? "category"),
          name: readString(categoryRecord, ["name", "title", "label"], "Категория"),
          slug: readNullableString(categoryRecord, ["slug", "code"]) ?? undefined
        }
      : null;
  const categoryId = explicitCategoryId ?? category?.id ?? null;
  const imageUrl = normalizeImageUrl(record);
  const price = normalizePrice(readNumber(record, ["priceKgs", "price_kgs", "price", "retail_price", "sale_price", "amount", "cost"]));
  const priceLabel = formatPriceLabel(price, readNullableString(record, ["priceLabel", "price_label", "price_text"]));
  const availability = normalizeAvailability(record);
  const stockQuantity = readNumber(record, ["stockQty", "pcs", "quantity", "stock", "stock_quantity", "available_quantity"]);
  const product: AppProduct = {
    id,
    categoryId,
    name,
    sku,
    description,
    imageUrl,
    price,
    priceLabel,
    availabilityLabel: availability.label,
    inStock: availability.inStock,
    stockQuantity,
    raw: value
  };

  return {
    ...product,
    category_id: categoryId,
    image_url: imageUrl,
    price_label: priceLabel,
    availability_status: availability.status,
    availability_label: availability.label,
    is_available: availability.inStock,
    stock_quantity: stockQuantity,
    category,
    brand,
    material: readNullableString(record, ["material"]),
    size: readNullableString(record, ["size", "diameter", "dimensions"]),
    purpose: readNullableString(record, ["purpose", "appointment", "usage"]),
    created_at: readNullableString(record, ["createdAt", "created_at"])
  };
}

export function adaptProducts(payload: unknown) {
  return normalizeArray(payload).map(adaptProduct);
}

export function adaptOrder(value: unknown): OrderListItem {
  const record = unwrapOrderRecord(value);
  const id = readString(record, ["id", "uuid", "order_id", "orderId"], "");
  const displayId = id || `local-${Date.now()}`;
  const status = normalizeOrderStatus(read(record, ["status", "state", "internalStatus"]));
  const items = normalizeArray(read(record, ["items", "order_items", "products"]));
  const itemsCount: number =
    readNumber(record, ["itemsCount", "items_count", "item_count", "quantity"]) ??
    items.reduce<number>((sum, item) => {
      if (!isRecord(item)) {
        return sum + 1;
      }
      return sum + (readNumber(item, ["quantity", "qty", "count"]) ?? 1);
    }, 0);
  const createdAt = readString(record, ["createdAt", "created_at", "date"], new Date().toISOString());
  const totalsRecord = isRecord(record.totals) ? record.totals : {};
  const totalAmount = normalizePrice(
    readNumber(record, ["totalKgs", "totalAmount", "total_amount", "total", "amount"]) ??
    readNumber(totalsRecord, ["totalKgs", "total", "amount"])
  );
  const totalLabel = totalAmount === null
    ? "Уточняется менеджером"
    : formatPriceLabel(totalAmount, readNullableString(record, ["totalLabel", "total_label", "total_text"]));
  const orderNumber = readString(
    record,
    ["orderNumber", "order_number", "number", "externalOrderId"],
    id ? `Заказ ${id.slice(-6).toUpperCase()}` : "Заказ оформлен"
  );
  const order: AppOrder = {
    id: displayId,
    orderNumber,
    status,
    statusLabel: statusLabels[status] ?? "Заказ создан",
    createdAt,
    itemsCount,
    totalAmount,
    totalLabel,
    raw: value
  };

  return {
    ...order,
    order_number: order.orderNumber,
    created_at: createdAt,
    item_count: itemsCount,
    total_amount: totalAmount,
    total_label: totalLabel
  };
}

export function adaptOrders(payload: unknown) {
  return normalizeArray(payload).map(adaptOrder);
}

export function adaptOrderItem(value: unknown, index: number): OrderItem {
  const record = isRecord(value) ? value : {};
  const product = isRecord(record.product) ? record.product : null;
  const productName =
    readNullableString(record, ["product_name", "productName", "name", "title"]) ??
    (product ? readString(product, ["name", "title"], "Товар") : "Товар");
  const unitPrice = normalizePrice(readNumber(record, ["unit_price", "unitPrice", "priceKgs", "price", "amount"]));

  return {
    id: readString(record, ["id", "uuid"], `item-${index}`),
    product_id: readNullableString(record, ["product_id", "productId"]),
    product_name: productName,
    quantity: readNumber(record, ["quantity", "qty", "count"]) ?? 1,
    unit_price: unitPrice,
    unit_price_label: formatPriceLabel(unitPrice, readNullableString(record, ["unit_price_label", "price_label"]))
  };
}

export function adaptOrderDetail(value: unknown): OrderDetail {
  const record = unwrapOrderRecord(value);
  const order = adaptOrder(value);
  const storeRecord = isRecord(record.store) ? record.store : null;
  const customerRecord = isRecord(record.customer) ? record.customer : null;
  const status = normalizeOrderStatus(read(record, ["status", "state", "internalStatus"]));
  const events = normalizeArray(read(record, ["order_status_events", "status_events", "timeline"]));
  const eventCandidates: OrderStatusEvent[] = [
    ["created", "createdAt"],
    ["confirmed", "confirmedAt"],
    ["ready_for_pickup", "readyAt"],
    ["cancelled", "cancelledAt"],
    ["cancelled", "canceledAt"],
    ["completed", "completedAt"]
  ].flatMap(([eventStatus, key]) => {
    const createdAt = readNullableString(record, [key]);
    return createdAt
      ? [{
          id: `${eventStatus}-${createdAt}`,
          status: eventStatus,
          label: statusLabels[eventStatus] ?? "Статус обновлён",
          created_at: createdAt
        }]
      : [];
  });
  const fallbackEvent: OrderStatusEvent = {
    id: "created",
    status,
    label: statusLabels[status] ?? "Заказ создан",
    created_at: order.created_at
  };

  return {
    ...order,
    customer_name: customerRecord
      ? readString(customerRecord, ["name", "fullName", "full_name"], "Покупатель")
      : readString(record, ["customer_name", "customerName", "name"], "Покупатель"),
    customer_phone: customerRecord
      ? readString(customerRecord, ["phone", "phoneNumber", "phone_number"], "")
      : readString(record, ["customer_phone", "customerPhone", "phone"], ""),
    delivery_method: (readString(record, ["delivery_method", "deliveryMethod", "fulfillment"], "pickup") === "delivery"
      ? "delivery"
      : "pickup") as FulfillmentMethod,
    delivery_address: customerRecord
      ? readNullableString(customerRecord, ["address", "deliveryAddress", "delivery_address"])
      : readNullableString(record, ["delivery_address", "deliveryAddress", "address"]),
    store_id: readNullableString(record, ["store_id", "storeId"]),
    comment: readNullableString(record, ["comment", "note"]),
    store: storeRecord
      ? {
          id: readString(storeRecord, ["id", "uuid"], "store"),
          name: readString(storeRecord, ["name", "title"], "Авантехник"),
          address: readString(storeRecord, ["address"], ""),
          working_hours: readNullableString(storeRecord, ["working_hours", "workingHours"]),
          phone: readNullableString(storeRecord, ["phone"]),
          external_2gis_url: readNullableString(storeRecord, ["external_2gis_url", "twoGisUrl", "url"])
        }
      : null,
    order_items: normalizeArray(read(record, ["order_items", "items", "products"])).map(adaptOrderItem),
    order_status_events: events.length
      ? events.map((event, index) => {
          const eventRecord = isRecord(event) ? event : {};
          const eventStatus = normalizeOrderStatus(read(eventRecord, ["status", "state"]));
          return {
            id: readString(eventRecord, ["id", "uuid"], `status-${index}`),
            status: eventStatus,
            label: readString(eventRecord, ["label", "title", "name"], statusLabels[eventStatus] ?? "Статус обновлён"),
            created_at: readString(eventRecord, ["created_at", "createdAt", "date"], order.created_at)
          };
        })
      : eventCandidates.length
        ? eventCandidates
        : [fallbackEvent]
  };
}

export function getDataArray(payload: unknown) {
  return normalizeArray(payload);
}
