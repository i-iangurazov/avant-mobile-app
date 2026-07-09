import type { ProductFilter, ProductSort } from "../../hooks/useCatalog";
import { getCategories, getProductById, getProducts } from "../bazaar/client";

type ProductQuery = {
  categoryId?: string;
  search?: string;
  filter?: ProductFilter;
  sort?: ProductSort;
  limit?: number;
};

export async function fetchCategories() {
  return getCategories();
}

export async function fetchProducts({
  categoryId,
  search = "",
  sort = "name",
  limit
}: ProductQuery = {}) {
  return getProducts({
    categoryId,
    search,
    sort,
    limit
  });
}

export async function fetchProduct(productId: string) {
  return getProductById(productId);
}
