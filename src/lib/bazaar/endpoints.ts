export const BAZAAR_ENDPOINTS = {
  // TODO: Confirm exact Bazaar route for public/customer categories.
  categories: "/categories",
  // TODO: Confirm supported query params for category, search, stock and sorting.
  products: "/products",
  product: (id: string) => `/products?id=${encodeURIComponent(id)}`,
  // TODO: Confirm exact Bazaar customer order endpoints before production launch.
  orders: "/orders",
  order: (id: string) => `/orders/${encodeURIComponent(id)}`,
  // App backend routes backed by Postgres, not Bazaar API.
  login: "/auth/login",
  register: "/auth/register",
  profile: "/profile"
} as const;
