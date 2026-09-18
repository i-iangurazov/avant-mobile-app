import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCustomerProfile, updateCustomerProfile } from "../lib/api/account";
import { friendlyError, normalizePhone } from "../lib/formatters";
import type { UserProfile } from "../types";
import { useAuth } from "./useAuth";

export function useProfile() {
  const { session, user, updateSessionUser } = useAuth();

  const query = useQuery({
    queryKey: ["profile", session?.user.id, session?.user.phone],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      if (!session) {
        throw new Error("Войдите в аккаунт.");
      }

      return getCustomerProfile(session);
    }
  });

  useEffect(() => {
    if (!query.data || !user) return;
    const currentStatus = user.plumber?.applicationStatus ?? null;
    const freshStatus = query.data.plumber?.applicationStatus ?? null;
    if (currentStatus !== freshStatus || user.isAdmin !== query.data.isAdmin || user.name !== query.data.name || user.phone !== query.data.phone) {
      void updateSessionUser(query.data);
    }
  }, [query.data, updateSessionUser, user]);

  return query;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { session, user, updateSessionUser } = useAuth();

  return useMutation({
    mutationFn: async (payload: { name: string; phone: string; address: string }) => {
      if (!user?.id) {
        throw new Error("Войдите в аккаунт.");
      }

      try {
        const profile = await updateCustomerProfile({
          name: payload.name,
          phone: normalizePhone(payload.phone),
          address: payload.address
        }, session?.accessToken);
        await updateSessionUser(profile);
        return profile satisfies UserProfile;
      } catch (error) {
        throw new Error(friendlyError(error instanceof Error ? error.message : undefined));
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    }
  });
}
