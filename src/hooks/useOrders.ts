import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createOrder, fetchOrder, fetchOrders } from "../lib/api/orders";
import { clearLocalCart, getLocalCartItems } from "../lib/cart/localCart";
import type { FulfillmentMethod } from "../types";
import { useAuth } from "./useAuth";

export function useOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["orders", user?.id, user?.phone],
    enabled: Boolean(user?.id),
    queryFn: () => fetchOrders({ phone: user?.phone ?? null })
  });
}

export function useOrder(orderId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["order", orderId, user?.id],
    enabled: Boolean(orderId && user?.id),
    queryFn: async () => {
      if (!orderId) {
        throw new Error("Заказ не найден.");
      }

      return fetchOrder(orderId);
    }
  });
}

export function useCreateOrderFromCart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      customerName: string;
      customerPhone: string;
      deliveryMethod: FulfillmentMethod;
      storeId?: string | null;
      deliveryAddress?: string | null;
      comment?: string | null;
    }) => {
      const items = await getLocalCartItems();

      if (!items.length) {
        throw new Error("Корзина пуста.");
      }

      const order = await createOrder({
        ...payload,
        items
      });

      return {
        ...order,
        order_id: order.id
      };
    },
    onSuccess: async () => {
      await clearLocalCart();
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
    }
  });
}
