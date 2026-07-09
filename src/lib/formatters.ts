import type { OrderStatus } from "../types";
import { normalizeApiError } from "./errors/normalizeApiError";

export const statusLabels: Record<string, string> = {
  new: "Новый",
  created: "Заказ создан",
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждён",
  processing: "В обработке",
  assembling: "Собирается",
  ready: "Готов к выдаче",
  ready_for_pickup: "Готов к выдаче",
  delivery: "В доставке",
  on_the_way: "В пути",
  completed: "Завершён",
  cancelled: "Отменён",
  canceled: "Отменён"
};

export const statusSteps: OrderStatus[] = [
  "created",
  "confirmed",
  "assembling",
  "ready_for_pickup",
  "on_the_way",
  "completed"
];

export const formatPrice = (
  price: number | string | null | undefined,
  fallback = "Цена уточняется"
) => {
  if (price === null || price === undefined || price === "") {
    return fallback;
  }

  const numericPrice = typeof price === "string" ? Number(price) : price;

  if (!Number.isFinite(numericPrice)) {
    return fallback;
  }

  return `${numericPrice.toLocaleString("ru-RU")} сом`;
};

export const formatDate = (date: string | Date | null | undefined) => {
  if (!date) {
    return "Дата уточняется";
  }

  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("996")) {
    return `+${digits.slice(0, 12)}`;
  }

  if (digits.startsWith("0")) {
    return `+996${digits.slice(1, 10)}`;
  }

  return `+996${digits.slice(0, 9)}`;
};

export const formatKyrgyzPhoneInput = (value: string) => {
  const normalized = normalizePhone(value);
  const localDigits = normalized.replace(/^\+996/, "").replace(/\D/g, "").slice(0, 9);
  const first = localDigits.slice(0, 3);
  const second = localDigits.slice(3, 6);
  const third = localDigits.slice(6, 9);

  return ["+996", first, second, third].filter(Boolean).join(" ");
};

export const isValidKyrgyzPhone = (value: string) => /^\+996\d{9}$/.test(normalizePhone(value));

export const phoneValidationMessage = "Введите телефон в формате +996 XXX XXX XXX";

export const handleKyrgyzPhoneInput = (value: string) => formatKyrgyzPhoneInput(value);

export const friendlyError = (message?: string) => {
  return normalizeApiError(message);
};
