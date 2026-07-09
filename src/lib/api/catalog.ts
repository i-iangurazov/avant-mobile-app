import type { ProductFilter, ProductSort } from "../../hooks/useCatalog";
import { getCategories, getProductById, getProducts, getProductsPage } from "../bazaar/client";

type ProductQuery = {
  categoryId?: string;
  search?: string;
  filter?: ProductFilter;
  sort?: ProductSort;
  limit?: number;
  page?: number;
  pageSize?: number;
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

export async function fetchProductPage({
  categoryId,
  search = "",
  sort = "name",
  page = 1,
  pageSize = 40
}: ProductQuery = {}) {
  return getProductsPage({
    categoryId,
    search,
    sort,
    page,
    pageSize
  });
}

export async function fetchProduct(productId: string) {
  return getProductById(productId);
}
