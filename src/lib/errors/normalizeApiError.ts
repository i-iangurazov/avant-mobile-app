const UNKNOWN_ERROR = "Что-то пошло не так. Попробуйте ещё раз.";

const getRawMessage = (error: unknown) => {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.details ?? record.hint;

    if (typeof message === "string") {
      return message;
    }
  }

  return "";
};

const isDevelopmentRuntime = () => {
  const devFlag = (globalThis as { __DEV__?: boolean }).__DEV__;
  return Boolean(devFlag);
};

export function normalizeApiError(error: unknown, fallback = UNKNOWN_ERROR) {
  const rawMessage = getRawMessage(error);
  const lower = rawMessage.toLowerCase();

  if (isDevelopmentRuntime() && error) {
    console.warn("[api:error]", error);
  }

  if (rawMessage.includes("Недостаточно товаров для корректировки")) {
    return "Недостаточно товара на складе";
  }

  if (rawMessage.includes("Недостаточно товаров для оприходования")) {
    return "Не удалось обновить наличие товара";
  }

  if (
    lower.includes("stock") ||
    lower.includes("out of stock") ||
    lower.includes("availability") ||
    lower.includes("not enough") ||
    lower.includes("quantity") ||
    lower.includes("недостаточно товара") ||
    lower.includes("нет в наличии") ||
    lower.includes("налич")
  ) {
    return "Товар временно недоступен или его недостаточно на складе";
  }

  if (
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("auth")
  ) {
    return "Неверный телефон или пароль";
  }

  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "Пользователь с таким телефоном уже зарегистрирован.";
  }

  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return "Нет соединения. Проверьте интернет.";
  }

  if (
    lower.includes("server") ||
    lower.includes("internal") ||
    lower.includes("service unavailable") ||
    lower.includes("bad gateway") ||
    lower.includes("gateway timeout") ||
    lower.includes(" 500") ||
    lower.includes(" 502") ||
    lower.includes(" 503") ||
    lower.includes(" 504")
  ) {
    return "Сервис временно недоступен. Попробуйте позже.";
  }

  if (lower.includes("password")) {
    return "Проверьте пароль. Минимальная длина обычно 6 символов.";
  }

  return rawMessage || fallback;
}
