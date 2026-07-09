import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addLocalCartItem } from "../lib/cart/localCart";
import { fetchCategories, fetchProduct, fetchProducts } from "../lib/api/catalog";
import type { Product } from "../types";

export type ProductSort = "name" | "price_asc" | "price_desc";
export type ProductFilter = "all";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });
}

export function useProductsByCategory(
  categoryId?: string,
  search = "",
  filter: ProductFilter = "all",
  sort: ProductSort = "name"
) {
  return useQuery({
    queryKey: ["products", categoryId, search, filter, sort],
    enabled: Boolean(categoryId),
    queryFn: async () => {
      if (!categoryId) {
        return [];
      }

      return fetchProducts({
        categoryId,
        search,
        filter,
        sort
      });
    }
  });
}

export function useProduct(productId?: string) {
  return useQuery({
    queryKey: ["product", productId],
    enabled: Boolean(productId),
    queryFn: async () => {
      if (!productId) {
        throw new Error("Товар не найден.");
      }

      return fetchProduct(productId);
    }
  });
}

export function usePopularProducts(limit = 4) {
  return useQuery({
    queryKey: ["popular-products", limit],
    queryFn: () =>
      fetchProducts({
        sort: "name",
        limit
      })
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      product,
      quantity = 1
    }: {
      productId: string;
      product?: Product;
      quantity?: number;
    }) => {
      const cartProduct = product ?? (await fetchProduct(productId));
      await addLocalCartItem(cartProduct, quantity);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
    }
  });
}
