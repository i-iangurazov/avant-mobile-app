import type { UserProfile } from "../../types";

export type LoginCustomerPayload = {
  phone: string;
  password: string;
};

export type RegisterCustomerPayload = {
  name: string;
  phone: string;
  address: string;
  password: string;
  accountType?: "customer" | "plumber";
  plumberApplication?: {
    fullName: string;
    city: string;
    workingDistricts: string[];
    specializations: string[];
    experienceYears: number;
    profilePhotoUrl?: string | null;
    description?: string | null;
    programConsent: boolean;
    dataProcessingConsent: boolean;
  };
};

export type UpdateCustomerProfilePayload = {
  name: string;
  phone: string;
  address: string;
};

export type AppCustomer = UserProfile;

export type AppCustomerSession = {
  accessToken?: string | null;
  refreshToken?: string | null;
  user: AppCustomer;
  raw?: unknown;
};
