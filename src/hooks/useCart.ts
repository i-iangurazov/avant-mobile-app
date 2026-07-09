import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLocalCartItems,
  removeLocalCartItem,
  updateLocalCartItemQuantity
} from "../lib/cart/localCart";

export function useCart() {
  return useQuery({
    queryKey: ["cart"],
    queryFn: async () => ({
      cartId: "local-cart",
      items: await getLocalCartItems()
    })
  });
}

export function useCartMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["cart"] });
  };

  const updateQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      await updateLocalCartItemQuantity(itemId, quantity);
    },
    onSuccess: invalidate
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await removeLocalCartItem(itemId);
    },
    onSuccess: invalidate
  });

  return {
    updateQuantity,
    removeItem
  };
}
