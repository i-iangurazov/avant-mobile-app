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
    return `+${digits}`;
  }

  if (digits.startsWith("0")) {
    return `+996${digits.slice(1)}`;
  }

  return digits.length === 9 ? `+996${digits}` : `+${digits}`;
};

export const formatKyrgyzPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const international = value.trimStart().startsWith("+");
  // A controlled native input receives every keystroke, including '+' and '+9'.
  // Adding +996 at that point used to duplicate the country code and lose digits.
  if (!digits) return international ? "+" : "";
  if (international && digits.length <= 3 && "996".startsWith(digits)) return `+${digits}`;
  if (international && !digits.startsWith("996")) return `+${digits}`;
  const hasCountry = digits.startsWith("996") && (international || digits.length > 9);
  const nationalPrefix = !hasCountry && digits.startsWith("0") ? "0" : "";
  const localDigits = hasCountry ? digits.slice(3) : digits.slice(nationalPrefix.length);
  // Preserve excess digits so validation rejects them instead of changing the number.
  const groups = [localDigits.slice(0, 3), localDigits.slice(3, 6), localDigits.slice(6)].filter(Boolean).join(" ");
  return hasCountry ? ["+996", groups].filter(Boolean).join(" ") : nationalPrefix + groups;
};

export const isValidKyrgyzPhone = (value: string) => /^\+996\d{9}$/.test(normalizePhone(value));

export const phoneValidationMessage = "Введите телефон в формате +996 XXX XXX XXX";

export const handleKyrgyzPhoneInput = (value: string) => formatKyrgyzPhoneInput(value);

export const friendlyError = (message?: string) => {
  return normalizeApiError(message);
};

export const pluralizeRu = (count: number, one: string, few: string, many: string) => {
  const value = Math.abs(count);
  if (!Number.isInteger(value)) return few;
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
