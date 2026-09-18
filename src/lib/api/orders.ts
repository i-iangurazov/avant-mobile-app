import type { CartItemWithProduct, FulfillmentMethod } from "../../types";
import { adaptOrder, adaptOrderDetail, adaptOrders } from "../bazaar/adapters";
import { appApiClient } from "./client";

export type CreateOrderPayload = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: FulfillmentMethod;
  storeId?: string | null;
  storeName?: string | null;
  storeAddress?: string | null;
  deliveryAddress?: string | null;
  comment?: string | null;
  orderKind?: "order" | "reservation";
  projectNote?: string | null;
  items: CartItemWithProduct[];
};

const authHeaders = (accessToken?: string | null) => {
  if (!accessToken) {
    throw new Error("Войдите в аккаунт.");
  }
  return { Authorization: `Bearer ${accessToken}` };
};

const clientRequestId = () =>
  `order_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

export async function fetchOrders(accessToken?: string | null) {
  const response = await appApiClient.request<unknown>("/orders", {
    headers: authHeaders(accessToken)
  });
  return adaptOrders(response);
}

export async function fetchOrder(orderId: string, accessToken?: string | null) {
  const response = await appApiClient.request<unknown>(`/orders/${encodeURIComponent(orderId)}`, {
    headers: authHeaders(accessToken)
  });
  return adaptOrderDetail(response);
}

export async function createOrder(payload: CreateOrderPayload, accessToken?: string | null) {
  const response = await appApiClient.request<unknown>("/orders", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      clientRequestId: clientRequestId(),
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      deliveryMethod: payload.deliveryMethod,
      storeId: payload.storeId,
      storeName: payload.storeName,
      storeAddress: payload.storeAddress,
      deliveryAddress: payload.deliveryAddress,
      comment: payload.comment,
      orderKind: payload.orderKind,
      projectNote: payload.projectNote,
      items: payload.items.map((item) => ({
        productId: item.product_id,
        productName: item.product?.name || "Товар",
        quantity: item.quantity,
        unitPrice: item.product?.price ?? null,
        unitPriceLabel: item.product?.price_label ?? item.product?.priceLabel ?? null
      }))
    })
  });
  return adaptOrder(response);
}
