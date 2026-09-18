import { apiBaseUrl } from "../config/env";
import { normalizeApiError } from "../errors/normalizeApiError";

export class AppApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "AppApiError";
    this.status = status;
    this.payload = payload;
  }
}

class AppApiClient {
  async request<T>(path: string, init: RequestInit = {}) {
    if (!apiBaseUrl) {
      throw new Error("Не настроен сервер приложения. Укажите EXPO_PUBLIC_API_URL.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...init.headers
        }
      });
      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }

      if (!response.ok) {
        const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
        const message = record?.error ?? record?.message ?? record?.detail;
        throw new AppApiError(
          response.status,
          typeof message === "string" ? message : `Запрос к серверу завершился ошибкой ${response.status}`,
          payload
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof AppApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Сервис временно недоступен. Попробуйте позже.");
      }
      throw new Error(normalizeApiError(error));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const appApiClient = new AppApiClient();
