export type Availability = "in_stock" | "preorder" | "out_of_stock" | string;

export type OrderStatus =
  | "new"
  | "created"
  | "pending"
  | "confirmed"
  | "processing"
  | "assembling"
  | "ready"
  | "ready_for_pickup"
  | "delivery"
  | "on_the_way"
  | "completed"
  | "cancelled"
  | "canceled"
  | string;

export type FulfillmentMethod = "pickup" | "delivery";

export type AppCategory = {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string | null;
  productsCount?: number | null;
};

export type AppProduct = {
  id: string;
  categoryId?: string | null;
  name: string;
  sku?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  priceLabel: string;
  availabilityLabel?: string | null;
  inStock?: boolean | null;
  stockQuantity?: number | null;
  raw?: unknown;
};

export type AppOrder = {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  itemsCount: number;
  totalAmount?: number | null;
  totalLabel?: string | null;
  raw?: unknown;
};

export type Category = AppCategory & {
  image_url?: string | null;
  product_count?: number | null;
};

export type Product = AppProduct & {
  category_id?: string | null;
  image_url?: string | null;
  price_label?: string | null;
  availability_status?: Availability | null;
  availability_label?: string | null;
  is_available?: boolean | null;
  stock_quantity?: number | null;
  category?: Pick<Category, "id" | "name" | "slug"> | null;
  brand?: string | null;
  material?: string | null;
  size?: string | null;
  purpose?: string | null;
  created_at?: string | null;
};

export type StoreLocation = {
  id: string;
  name: string;
  address: string;
  working_hours?: string | null;
  phone?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  external_2gis_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export type UserProfile = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CartItemWithProduct = {
  id: string;
  product_id: string;
  product: Product | null;
  quantity: number;
  created_at: string;
};

export type OrderListItem = AppOrder & {
  order_number: string;
  created_at: string;
  item_count: number;
  total_amount?: number | null;
  total_label?: string | null;
};

export type OrderItem = {
  id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price?: number | null;
  unit_price_label?: string | null;
};

export type OrderStatusEvent = {
  id: string;
  status: OrderStatus;
  label: string;
  created_at: string;
};

export type OrderDetail = OrderListItem & {
  store: StoreLocation | null;
  order_items: OrderItem[];
  order_status_events: OrderStatusEvent[];
  customer_name: string;
  customer_phone: string;
  delivery_method: FulfillmentMethod;
  delivery_address?: string | null;
  store_id?: string | null;
  comment?: string | null;
};
