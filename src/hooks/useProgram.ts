import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignAdminLead,
  cancelCustomerServiceRequest,
  createCustomerServiceRequest,
  createTelegramLink,
  getAdminLeads,
  getAdminLoyaltyConfig,
  getAdminPlumbers,
  getAdminProgram,
  getCustomerServiceRequests,
  getLeadCandidates,
  getLoyaltyTransactions,
  getPlumberApplication,
  getPlumberDashboard,
  getPlumberLeads,
  getPlumberQr,
  getPlumberReviews,
  getProgramContent,
  getRewards,
  getTelegramLink,
  ingestAdminReceipt,
  ingestAdminReturn,
  markPlumberLeadViewed,
  redeemReward,
  registerForTraining,
  reviewServiceRequest,
  submitPlumberApplication,
  updateAdminPlumberStatus,
  updateAdminLoyaltyConfig,
  updateAdminRedemption,
  updateTelegramPreferences,
  updatePlumberLead,
  type ManualReceiptPayload,
  type ManualReturnPayload,
  type PlumberApplicationPayload,
  type ServiceRequestPayload
} from "../lib/api/program";
import { useAuth } from "./useAuth";

export function usePlumberApplication() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["plumber-application", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => getPlumberApplication(session?.accessToken)
  });
}

export function useSubmitPlumberApplication() {
  const { session, user, updateSessionUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlumberApplicationPayload) => submitPlumberApplication(payload, session?.accessToken),
    onSuccess: async (plumber) => {
      if (user) await updateSessionUser({ ...user, accountType: "plumber", plumber });
      void queryClient.invalidateQueries({ queryKey: ["plumber-application", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  });
}

export function usePlumberDashboard() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["plumber-dashboard", user?.id],
    enabled: user?.plumber?.applicationStatus === "approved",
    queryFn: () => getPlumberDashboard(session?.accessToken),
    refetchInterval: 30_000
  });
}

export function usePlumberQr() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["plumber-qr", user?.id],
    enabled: user?.plumber?.applicationStatus === "approved",
    queryFn: () => getPlumberQr(session?.accessToken)
  });
}

export function usePlumberReviews() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["plumber-reviews", user?.id],
    enabled: user?.plumber?.applicationStatus === "approved",
    queryFn: () => getPlumberReviews(session?.accessToken)
  });
}

export function useLoyaltyHistory(filters: { status?: string; type?: string } = {}) {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["loyalty-history", user?.id, filters.status ?? "all", filters.type ?? "all"],
    enabled: user?.plumber?.applicationStatus === "approved",
    queryFn: () => getLoyaltyTransactions(filters, session?.accessToken)
  });
}

export function useRewards() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["loyalty-rewards", user?.id],
    enabled: user?.plumber?.applicationStatus === "approved",
    queryFn: () => getRewards(session?.accessToken)
  });
}

export function useRedeemReward() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId, clientRequestId }: { rewardId: string; clientRequestId: string }) =>
      redeemReward(rewardId, clientRequestId, session?.accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loyalty-rewards", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["plumber-dashboard", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["loyalty-history", user?.id] });
    }
  });
}

export function useProgramContent() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["program-content", user?.id],
    enabled: user?.plumber?.applicationStatus === "approved",
    queryFn: () => getProgramContent(session?.accessToken)
  });
}

export function useRegisterForTraining() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contentId: string) => registerForTraining(contentId, session?.accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["program-content", user?.id] })
  });
}

export function useTelegramLink() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["telegram-link", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => getTelegramLink(session?.accessToken)
  });
}

export function useCreateTelegramLink() {
  const { session } = useAuth();
  return useMutation({ mutationFn: () => createTelegramLink(session?.accessToken) });
}

export function useUpdateTelegramPreferences() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { notificationsEnabled: boolean; preferences: Record<string, boolean> }) =>
      updateTelegramPreferences(payload, session?.accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["telegram-link", user?.id] })
  });
}

export function useCustomerServiceRequests() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["customer-service-requests", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => getCustomerServiceRequests(session?.accessToken),
    refetchInterval: 30_000
  });
}

export function useCreateServiceRequest() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ServiceRequestPayload) => createCustomerServiceRequest(payload, session?.accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customer-service-requests", user?.id] })
  });
}

export function useCancelServiceRequest() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelCustomerServiceRequest(id, session?.accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customer-service-requests", user?.id] })
  });
}

export function useReviewServiceRequest() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, review, tags }: { id: string; rating: number; review?: string; tags?: string[] }) =>
      reviewServiceRequest(id, { rating, review, tags }, session?.accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customer-service-requests", user?.id] })
  });
}

export function usePlumberLeads() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["plumber-leads", user?.id],
    enabled: user?.plumber?.applicationStatus === "approved",
    queryFn: () => getPlumberLeads(session?.accessToken),
    refetchInterval: 20_000
  });
}

export function useUpdatePlumberLead() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "viewed" | "accepted" | "declined" | "in_progress" | "completed" }) =>
      status === "viewed"
        ? markPlumberLeadViewed(id, session?.accessToken)
        : updatePlumberLead(id, status, session?.accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plumber-leads", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["plumber-dashboard", user?.id] });
    }
  });
}

export function useAdminProgram() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["admin-program", user?.id],
    enabled: user?.isAdmin === true,
    queryFn: () => getAdminProgram(session?.accessToken)
  });
}

export function useAdminPlumbers() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["admin-plumbers", user?.id],
    enabled: user?.isAdmin === true,
    queryFn: () => getAdminPlumbers(session?.accessToken)
  });
}

export function useAdminLoyaltyConfig() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["admin-loyalty-config", user?.id],
    enabled: user?.isAdmin === true,
    queryFn: () => getAdminLoyaltyConfig(session?.accessToken)
  });
}

export function useUpdateAdminLoyaltyConfig() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { baseRateBps: number; pendingDays: number; rollingPeriodDays: number; levels?: { id: string; thresholdMinor: string; bonusRateBps: number }[] }) => updateAdminLoyaltyConfig(payload, session?.accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-loyalty-config", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["plumber-dashboard"] });
    }
  });
}

export function useUpdateAdminPlumber() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plumberId, status, reason }: { plumberId: string; status: "pending" | "approved" | "rejected" | "suspended"; reason: string | null }) =>
      updateAdminPlumberStatus(plumberId, status, reason, session?.accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-plumbers", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-program", user?.id] });
    }
  });
}

export function useAdminLeads() {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["admin-leads", user?.id],
    enabled: user?.isAdmin === true,
    queryFn: () => getAdminLeads(session?.accessToken)
  });
}

export function useLeadCandidates(leadId?: string) {
  const { session, user } = useAuth();
  return useQuery({
    queryKey: ["lead-candidates", leadId],
    enabled: user?.isAdmin === true && Boolean(leadId),
    queryFn: () => getLeadCandidates(leadId as string, session?.accessToken)
  });
}

export function useAssignAdminLead() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, plumberId }: { leadId: string; plumberId: string }) => assignAdminLead(leadId, plumberId, session?.accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-leads", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-program", user?.id] });
    }
  });
}

export function useIngestAdminReceipt() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManualReceiptPayload) => ingestAdminReceipt(payload, session?.accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-program", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["plumber-dashboard"] });
    }
  });
}

export function useIngestAdminReturn() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManualReturnPayload) => ingestAdminReturn(payload, session?.accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-program", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["plumber-dashboard"] });
    }
  });
}

export function useUpdateAdminRedemption() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: "approved" | "fulfilled" | "cancelled"; note?: string | null }) => updateAdminRedemption(id, status, note ?? null, session?.accessToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-program", user?.id] })
  });
}
