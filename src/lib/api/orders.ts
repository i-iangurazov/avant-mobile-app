import type { CartItemWithProduct, FulfillmentMethod } from "../../types";
import { createOrder as createBazaarOrder, getOrderById, getOrders } from "../bazaar/client";

export type CreateOrderPayload = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: FulfillmentMethod;
  storeId?: string | null;
  deliveryAddress?: string | null;
  comment?: string | null;
  items: CartItemWithProduct[];
};

export async function fetchOrders(query?: { phone?: string | null }) {
  return getOrders(query);
}

export async function fetchOrder(orderId: string) {
  return getOrderById(orderId);
}

export async function createOrder(payload: CreateOrderPayload) {
  return createBazaarOrder(payload);
}

