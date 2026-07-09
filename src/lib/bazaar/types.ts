import type { UserProfile } from "../../types";

export type BazaarQueryParams = Record<string, string | number | boolean | null | undefined>;

export type LoginCustomerPayload = {
  phone: string;
  password: string;
};

export type RegisterCustomerPayload = {
  name: string;
  phone: string;
  address: string;
  password: string;
};

export type UpdateCustomerProfilePayload = {
  name: string;
  phone: string;
  address: string;
};

export type BazaarCustomer = UserProfile;

export type BazaarCustomerSession = {
  accessToken?: string | null;
  refreshToken?: string | null;
  user: BazaarCustomer;
  raw?: unknown;
};

