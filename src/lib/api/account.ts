import { normalizeApiError } from "../errors/normalizeApiError";
import { appApiClient } from "./client";
import type {
  AppCustomer,
  AppCustomerSession,
  LoginCustomerPayload,
  RegisterCustomerPayload,
  UpdateCustomerProfilePayload
} from "./types";
import type { PlumberProfile } from "../../types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const read = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const readRecord = (record: Record<string, unknown>, keys: string[]) => {
  const value = read(record, keys);
  return isRecord(value) ? value : null;
};

const readString = (record: Record<string, unknown>, keys: string[], fallback = "") => {
  const value = read(record, keys);
  return value === undefined ? fallback : String(value);
};

const readBoolean = (record: Record<string, unknown>, keys: string[], fallback = false) => {
  const value = read(record, keys);
  return typeof value === "boolean" ? value : fallback;
};

const readStringArray = (record: Record<string, unknown>, keys: string[]) => {
  const value = read(record, keys);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

const adaptPlumber = (value: unknown): PlumberProfile | null => {
  if (!isRecord(value)) return null;
  const telegram = readRecord(value, ["telegram"]) ?? {};
  const preferences = readRecord(value, ["notificationPreferences"]) ?? {};
  const ratingValue = read(value, ["rating"]);
  return {
    id: readString(value, ["id"]),
    accountId: readString(value, ["accountId"]),
    publicId: readString(value, ["publicId"]),
    loyaltyCode: readString(value, ["loyaltyCode"]),
    applicationStatus: readString(value, ["applicationStatus"], "pending") as PlumberProfile["applicationStatus"],
    fullName: readString(value, ["fullName"]),
    phone: readString(value, ["phone"]),
    city: readString(value, ["city"], "Бишкек"),
    workingDistricts: readStringArray(value, ["workingDistricts"]),
    specializations: readStringArray(value, ["specializations"]),
    experienceYears: Number(read(value, ["experienceYears"]) ?? 0),
    profilePhotoUrl: readString(value, ["profilePhotoUrl"]) || null,
    description: readString(value, ["description"]) || null,
    isAvailableForLeads: readBoolean(value, ["isAvailableForLeads"], true),
    notificationPreferences: Object.fromEntries(
      Object.entries(preferences).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    ),
    telegram: {
      connected: readBoolean(telegram, ["connected"]),
      username: readString(telegram, ["username"]) || null,
      notificationsEnabled: readBoolean(telegram, ["notificationsEnabled"])
    },
    rating: ratingValue === null || ratingValue === undefined ? null : Number(ratingValue),
    reviewsCount: Number(read(value, ["reviewsCount"]) ?? 0),
    rejectionReason: readString(value, ["rejectionReason"]) || null,
    suspensionReason: readString(value, ["suspensionReason"]) || null,
    verifiedAt: readString(value, ["verifiedAt"]) || null,
    createdAt: readString(value, ["createdAt"]),
    updatedAt: readString(value, ["updatedAt"])
  };
};

const adaptCustomerSession = (
  payload: unknown,
  fallback: { phone: string; name?: string; address?: string | null }
): AppCustomerSession => {
  const root = isRecord(payload) ? payload : {};
  const data = readRecord(root, ["data"]) ?? root;
  const sessionRecord = readRecord(data, ["session", "auth", "token"]) ?? data;
  const userRecord = readRecord(data, ["user", "customer", "profile", "client"]) ?? data;
  const accessToken = readString(sessionRecord, ["accessToken", "access_token", "token", "jwt"], "");
  const refreshToken = readString(sessionRecord, ["refreshToken", "refresh_token"], "");
  const id = readString(userRecord, ["id", "uuid", "customer_id", "customerId", "user_id", "phone"], "") || fallback.phone;
  const user: AppCustomer = {
    id,
    name: readString(userRecord, ["name", "full_name", "fullName"], fallback.name || "Покупатель"),
    phone: readString(userRecord, ["phone", "phone_number", "phoneNumber"], fallback.phone),
    address: readString(userRecord, ["address", "delivery_address", "deliveryAddress"], fallback.address || ""),
    accountType: readString(userRecord, ["accountType"], "customer") === "plumber" ? "plumber" : "customer",
    roles: readStringArray(userRecord, ["roles"]) as AppCustomer["roles"],
    isAdmin: readBoolean(userRecord, ["isAdmin"]),
    plumber: adaptPlumber(read(userRecord, ["plumber"]))
  };

  if (!user.phone && !accessToken) {
    throw new Error("Сервер авторизации вернул неподдерживаемый формат ответа.");
  }
  return { accessToken: accessToken || null, refreshToken: refreshToken || null, user, raw: payload };
};

export async function loginCustomer(payload: LoginCustomerPayload) {
  try {
    const response = await appApiClient.request<unknown>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return adaptCustomerSession(response, { phone: payload.phone });
  } catch (error) {
    throw new Error(normalizeApiError(error));
  }
}

export async function registerCustomer(payload: RegisterCustomerPayload) {
  try {
    const response = await appApiClient.request<unknown>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return adaptCustomerSession(response, payload);
  } catch (error) {
    throw new Error(normalizeApiError(error));
  }
}

export async function getCustomerProfile(session: AppCustomerSession): Promise<AppCustomer> {
  const response = await appApiClient.request<unknown>("/profile", {
    headers: session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined
  });
  return adaptCustomerSession(response, session.user).user;
}

export async function updateCustomerProfile(
  payload: UpdateCustomerProfilePayload,
  accessToken?: string | null
): Promise<AppCustomer> {
  const response = await appApiClient.request<unknown>("/profile", {
    method: "PATCH",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: JSON.stringify(payload)
  });
  return adaptCustomerSession(response, payload).user;
}

export async function refreshCustomerSession(session: AppCustomerSession) {
  const response = await appApiClient.request<unknown>('/auth/refresh', { method: 'POST', body: JSON.stringify({refreshToken:session.refreshToken}) });
  return adaptCustomerSession(response, session.user);
}
