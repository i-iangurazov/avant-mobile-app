export const BAZAAR_ENDPOINTS = {
  // TODO: Confirm exact Bazaar route for public/customer categories.
  categories: "/categories",
  // TODO: Confirm supported query params for category, search, stock and sorting.
  products: "/products",
  product: (id: string) => `/products?id=${encodeURIComponent(id)}`
} as const;
