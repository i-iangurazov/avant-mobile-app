import type {
  LoyaltyReward,
  LoyaltyTransaction,
  PlumberDashboard,
  PlumberProfile,
  ProgramContent,
  ServiceRequest
} from "../../types";
import { appApiClient } from "./client";

type DataEnvelope<T> = { data: T };

const authHeaders = (accessToken?: string | null) =>
  accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

const request = async <T>(path: string, accessToken?: string | null, init: RequestInit = {}) => {
  const response = await appApiClient.request<DataEnvelope<T>>(path, {
    ...init,
    headers: { ...authHeaders(accessToken), ...init.headers }
  });
  return response.data;
};

export type PlumberApplicationPayload = {
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

export const getPlumberApplication = (accessToken?: string | null) =>
  request<PlumberProfile | null>("/plumber/application", accessToken);

export const submitPlumberApplication = (payload: PlumberApplicationPayload, accessToken?: string | null) =>
  request<PlumberProfile>("/plumber/application", accessToken, { method: "POST", body: JSON.stringify(payload) });

export const getPlumberDashboard = (accessToken?: string | null) =>
  request<PlumberDashboard>("/plumber/dashboard", accessToken);

export const getPlumberQr = (accessToken?: string | null) =>
  request<{ plumberName: string; loyaltyCode: string; qrPayload: string; level: PlumberDashboard["level"]["current"] }>(
    "/plumber/qr",
    accessToken
  );

export const getLoyaltyTransactions = (
  filters: { status?: string; type?: string; cursor?: string; limit?: number } = {},
  accessToken?: string | null
) => {
  const query = new URLSearchParams();
  query.set("limit", String(filters.limit ?? 30));
  if (filters.cursor) query.set("cursor", filters.cursor);
  if (filters.status) query.set("status", filters.status);
  if (filters.type) query.set("type", filters.type);
  return request<LoyaltyTransaction[]>(`/plumber/loyalty/transactions${query.size ? `?${query}` : ""}`, accessToken);
};

export const getRewards = (accessToken?: string | null) =>
  request<LoyaltyReward[]>("/plumber/rewards", accessToken);

export const redeemReward = (rewardId: string, clientRequestId: string, accessToken?: string | null) =>
  request<{ id: string; status: string; costMinor: string }>(`/plumber/rewards/${encodeURIComponent(rewardId)}/redeem`, accessToken, {
    method: "POST",
    body: JSON.stringify({ clientRequestId })
  });

export const getProgramContent = (accessToken?: string | null) =>
  request<ProgramContent[]>("/plumber/content", accessToken);

export type PlumberReview = {
  id: string;
  rating: number;
  review?: string | null;
  tags: string[];
  createdAt: string;
};

export const getPlumberReviews = (accessToken?: string | null) =>
  request<PlumberReview[]>("/plumber/reviews", accessToken);

export const registerForTraining = (contentId: string, accessToken?: string | null) =>
  request<{ id: string; status: string }>(`/plumber/content/${encodeURIComponent(contentId)}/register`, accessToken, { method: "POST" });

export type TelegramLinkStatus = {
  connected: boolean;
  username?: string | null;
  notificationsEnabled: boolean;
  linkedAt?: string | null;
  preferences: Record<string, boolean>;
};

export const getTelegramLink = (accessToken?: string | null) =>
  request<TelegramLinkStatus>("/telegram/link", accessToken);

export const createTelegramLink = (accessToken?: string | null) =>
  request<{ expiresInSeconds: number; command: string; url?: string | null }>("/telegram/link-token", accessToken, { method: "POST" });

export const updateTelegramPreferences = (
  payload: { notificationsEnabled: boolean; preferences: Record<string, boolean> },
  accessToken?: string | null
) => request<TelegramLinkStatus>("/telegram/preferences", accessToken, { method: "PATCH", body: JSON.stringify(payload) });

export type ServiceRequestPayload = {
  serviceType: string;
  description: string;
  district: string;
  address?: string | null;
  preferredAt?: string | null;
  phone: string;
  photoUrls?: string[];
  relatedProductIds?: string[];
  relatedOrderId?: string | null;
  consentToShare: boolean;
};

export const getCustomerServiceRequests = (accessToken?: string | null) =>
  request<ServiceRequest[]>("/service-requests", accessToken);

export const createCustomerServiceRequest = (payload: ServiceRequestPayload, accessToken?: string | null) =>
  request<ServiceRequest>("/service-requests", accessToken, { method: "POST", body: JSON.stringify(payload) });

export const cancelCustomerServiceRequest = (id: string, accessToken?: string | null) =>
  request<ServiceRequest>(`/service-requests/${encodeURIComponent(id)}/cancel`, accessToken, { method: "POST" });

export const reviewServiceRequest = (
  id: string,
  payload: { rating: number; review?: string; tags?: string[] },
  accessToken?: string | null
) => request<{ id: string }>(`/service-requests/${encodeURIComponent(id)}/review`, accessToken, {
  method: "POST",
  body: JSON.stringify(payload)
});

export const getPlumberLeads = (accessToken?: string | null) =>
  request<ServiceRequest[]>("/plumber/leads", accessToken);

export const markPlumberLeadViewed = (id: string, accessToken?: string | null) =>
  request<ServiceRequest>(`/plumber/leads/${encodeURIComponent(id)}/view`, accessToken, { method: "POST" });

export const updatePlumberLead = (
  id: string,
  status: "accepted" | "declined" | "in_progress" | "completed",
  accessToken?: string | null
) => request<ServiceRequest>(`/plumber/leads/${encodeURIComponent(id)}/status`, accessToken, {
  method: "PATCH",
  body: JSON.stringify({ status })
});

export type AdminProgramOverview = {
  counts: { pendingPlumbers: number; approvedPlumbers: number; openLeads: number };
  notifications: Record<string, number>;
  recentReceipts: {
    id: string;
    externalReceiptId: string;
    receiptNumber: string;
    totalMinor: string;
    purchaseAt: string;
    loyaltyCode: string;
  }[];
  redemptions: {
    id: string;
    status: string;
    costMinor: string;
    createdAt: string;
    rewardTitle: string;
    plumberName: string;
  }[];
};

export const getAdminProgram = (accessToken?: string | null) =>
  request<AdminProgramOverview>("/admin/program", accessToken);

export type AdminLoyaltyConfig = {
  baseRateBps: number;
  pendingDays: number;
  rollingPeriodDays: number;
  updatedAt: string;
  levels: PlumberDashboard["level"]["levels"];
};

export const getAdminLoyaltyConfig = (accessToken?: string | null) =>
  request<AdminLoyaltyConfig>("/admin/loyalty/config", accessToken);

export const updateAdminLoyaltyConfig = (
  payload: Pick<AdminLoyaltyConfig, "baseRateBps" | "pendingDays" | "rollingPeriodDays"> & { levels?: { id: string; thresholdMinor: string; bonusRateBps: number }[] },
  accessToken?: string | null
) => request<AdminLoyaltyConfig>("/admin/loyalty/config", accessToken, { method: "PATCH", body: JSON.stringify(payload) });

export const getAdminPlumbers = (accessToken?: string | null) =>
  request<PlumberProfile[]>("/admin/plumbers", accessToken);

export const updateAdminPlumberStatus = (
  plumberId: string,
  status: "pending" | "approved" | "rejected" | "suspended",
  reason: string | null,
  accessToken?: string | null
) => request<{ changed: boolean; profile: PlumberProfile }>(`/admin/plumbers/${encodeURIComponent(plumberId)}/status`, accessToken, {
  method: "PATCH",
  body: JSON.stringify({ status, reason })
});

export const getAdminLeads = (accessToken?: string | null) =>
  request<ServiceRequest[]>("/admin/leads", accessToken);

export type LeadCandidate = {
  id: string;
  accountId: string;
  fullName: string;
  loyaltyCode: string;
  districts: string[];
  specializations: string[];
  rating?: number | null;
  reviewsCount: number;
  completionRate: number;
  districtMatch: boolean;
  specializationMatch: boolean;
  score: number;
};

export const getLeadCandidates = (leadId: string, accessToken?: string | null) =>
  request<LeadCandidate[]>(`/admin/leads/${encodeURIComponent(leadId)}/candidates`, accessToken);

export const assignAdminLead = (leadId: string, plumberId: string, accessToken?: string | null) =>
  request<{ assigned: boolean }>(`/admin/leads/${encodeURIComponent(leadId)}/assign`, accessToken, {
    method: "POST",
    body: JSON.stringify({ plumberId })
  });

export type ManualReceiptPayload = {
  externalReceiptId: string;
  receiptNumber: string;
  storeId: string;
  storeName?: string | null;
  plumberIdentifier: string;
  totalMinor: string;
  purchaseAt: string;
  source: "manual";
  items: {
    externalLineId: string;
    productId?: string | null;
    productName: string;
    brand?: string | null;
    quantityMilli: string;
    unitPriceMinor: string;
    lineTotalMinor: string;
  }[];
};

export const ingestAdminReceipt = (payload: ManualReceiptPayload, accessToken?: string | null) =>
  request<{ created: boolean; receipt: unknown }>("/admin/receipts", accessToken, { method: "POST", body: JSON.stringify(payload) });

export type ManualReturnPayload = {
  externalReturnId: string;
  externalReceiptId: string;
  returnAt: string;
  source: "manual";
  items: { externalLineId: string; quantityMilli: string; amountMinor: string }[];
};

export const ingestAdminReturn = (payload: ManualReturnPayload, accessToken?: string | null) =>
  request<{ created: boolean; returnId: string }>("/admin/returns", accessToken, { method: "POST", body: JSON.stringify(payload) });

export const updateAdminRedemption = (redemptionId: string, status: "approved" | "fulfilled" | "cancelled", note: string | null, accessToken?: string | null) =>
  request<{ changed: boolean; status: string }>(`/admin/redemptions/${encodeURIComponent(redemptionId)}/status`, accessToken, { method: "PATCH", body: JSON.stringify({ status, note }) });
