import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createOrder, fetchOrder, fetchOrders, hasPendingOrder, type OrderQuote } from "../lib/api/orders";
import { getLocalCartItems } from "../lib/cart/localCart";
import type { FulfillmentMethod } from "../types";
import { useAuth } from "./useAuth";

export function useOrders() {
  const { session, user } = useAuth();

  return useQuery({
    queryKey: ["orders", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchOrders(session?.accessToken),
    refetchInterval: 15_000
  });
}

export function useOrder(orderId?: string) {
  const { session, user } = useAuth();

  return useQuery({
    queryKey: ["order", orderId, user?.id],
    enabled: Boolean(orderId && user?.id),
    queryFn: async () => {
      if (!orderId) {
        throw new Error("Заказ не найден.");
      }

      return fetchOrder(orderId, session?.accessToken);
    },
    refetchInterval: 10_000
  });
}

export function useCreateOrderFromCart() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      quote?: OrderQuote | null;
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
    }) => {
      const originalItems = await getLocalCartItems();
      const items = originalItems.map(item => {
        const price = payload.quote?.items.find(line => line.productId === item.product_id);
        return price && item.product ? {...item,product:{...item.product,price:price.unitPrice,name:price.productName}} : item;
      });

      if (!user) throw new Error("Войдите в аккаунт.");
      if (!items.length && !await hasPendingOrder(user.id)) {
        throw new Error("Корзина пуста.");
      }

      const order = await createOrder({
        ...payload,
        items
      }, session?.accessToken, user.id);

      return {
        ...order,
        order_id: order.id
      };
    },
    onSuccess: async () => {

      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
    }
  });
}
