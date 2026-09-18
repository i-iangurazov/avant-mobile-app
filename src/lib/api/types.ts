import type { PhoneProof } from "../../components/PhoneVerification";
import type { UserProfile } from "../../types";

export type LoginCustomerPayload = {
  phoneProof?: PhoneProof;
  phone: string;
  password: string;
};

export type RegisterCustomerPayload = {
  phoneProof?: PhoneProof;
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
    programDocumentVersion?: string;
    privacyDocumentVersion?: string;
    programConsent: boolean;
    dataProcessingConsent: boolean;
  };
};

export type UpdateCustomerProfilePayload = {
  phoneProof?: PhoneProof;
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
