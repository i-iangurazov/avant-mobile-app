import AsyncStorage from "@react-native-async-storage/async-storage";
import { consumeSubmittedCart } from "../cart/localCart";
import { submitAttempt, attemptKey } from "../orders/checkoutAttempt";
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

export const orderBody = (payload: CreateOrderPayload, key: string) => ({
  clientRequestId:key, customerName:payload.customerName, customerPhone:payload.customerPhone,
  deliveryMethod:payload.deliveryMethod,storeId:payload.storeId,storeName:payload.storeName,storeAddress:payload.storeAddress,
  deliveryAddress:payload.deliveryAddress,comment:payload.comment,orderKind:payload.orderKind,projectNote:payload.projectNote,
  items:payload.items.map(item=>({productId:item.product_id,productName:item.product?.name || 'Товар',quantity:item.quantity,
    unitPrice:item.product?.price ?? null,unitPriceLabel:item.product?.price_label ?? null}))
});
export type OrderQuote = {totalAmount:string|null;fulfilmentMode?:'inventory'|'inquiry';availabilityNotice?:string|null;items:{productId:string;unitPrice:number|null;productName:string}[]};
export async function quoteOrder(payload:CreateOrderPayload,accessToken?:string|null) {
  const response=await appApiClient.request<{data:OrderQuote}>('/orders/quote',{method:'POST',headers:authHeaders(accessToken),body:JSON.stringify(orderBody(payload,'quote_preview'))});
  return response.data;
}
export const hasPendingOrder = async(accountId:string)=>Boolean(await AsyncStorage.getItem(attemptKey(accountId)));
export async function createOrder(payload:CreateOrderPayload, accessToken:string|null|undefined, accountId:string) {
 return submitAttempt(AsyncStorage,accountId,payload,async(body,key)=>{
  const response=await appApiClient.request<unknown>('/orders',{method:'POST',headers:authHeaders(accessToken),body:JSON.stringify(orderBody(body,key))});
  return adaptOrder(response);
 },async(body,key)=>consumeSubmittedCart(body.items,key));
}
