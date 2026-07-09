import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartItemWithProduct, Product } from "../../types";

const CART_STORAGE_KEY = "avantehnik:cart:v1";

const createCartItem = (product: Product, quantity: number): CartItemWithProduct => ({
  id: `${product.id}-${Date.now()}`,
  product_id: product.id,
  product,
  quantity,
  created_at: new Date().toISOString()
});

const parseCartItems = (value: string | null): CartItemWithProduct[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as CartItemWithProduct[]) : [];
  } catch {
    return [];
  }
};

export async function getLocalCartItems() {
  const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
  return parseCartItems(stored);
}

export async function setLocalCartItems(items: CartItemWithProduct[]) {
  await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  return items;
}

export async function addLocalCartItem(product: Product, quantity = 1) {
  const items = await getLocalCartItems();
  const existing = items.find((item) => item.product_id === product.id);

  if (existing) {
    const nextItems = items.map((item) =>
      item.id === existing.id ? { ...item, quantity: item.quantity + quantity, product } : item
    );
    return setLocalCartItems(nextItems);
  }

  return setLocalCartItems([...items, createCartItem(product, quantity)]);
}

export async function updateLocalCartItemQuantity(itemId: string, quantity: number) {
  const items = await getLocalCartItems();

  if (quantity < 1) {
    return setLocalCartItems(items.filter((item) => item.id !== itemId));
  }

  return setLocalCartItems(items.map((item) => (item.id === itemId ? { ...item, quantity } : item)));
}

export async function removeLocalCartItem(itemId: string) {
  const items = await getLocalCartItems();
  return setLocalCartItems(items.filter((item) => item.id !== itemId));
}

export async function clearLocalCart() {
  await AsyncStorage.removeItem(CART_STORAGE_KEY);
}
