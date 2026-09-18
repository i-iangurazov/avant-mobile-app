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
    return Array.isArray(parsed) ? (parsed as CartItemWithProduct[]) : parsed && typeof parsed === "object" && "items" in parsed && Array.isArray(parsed.items) ? parsed.items as CartItemWithProduct[] : [];
  } catch {
    return [];
  }
};

export async function getLocalCartItems() {
  const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
  return parseCartItems(stored);
}

export async function setLocalCartItems(items: CartItemWithProduct[]) {
  const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
  const previous = raw ? JSON.parse(raw) : {};
  await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify({items, applied: previous.applied || []}));
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

export async function consumeSubmittedCart(items: CartItemWithProduct[], key: string) {
  const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
  const previous = raw ? JSON.parse(raw) : {};
  const applied: string[] = previous.applied || [];
  if (applied.includes(key)) return;
  const current = parseCartItems(raw);
  const remaining = current.map(item => ({...item,quantity:item.quantity-(items.find(sent=>sent.id===item.id)?.quantity || 0)})).filter(item=>item.quantity>0);
  // Applied key and cart are a single stored value: a crash cannot subtract twice.
  await AsyncStorage.setItem(CART_STORAGE_KEY,JSON.stringify({items:remaining,applied:[...applied.slice(-99),key]}));
}
