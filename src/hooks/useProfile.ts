import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfileFromBazaar, updateProfileInBazaar } from "../lib/bazaar/client";
import { friendlyError, normalizePhone } from "../lib/formatters";
import type { UserProfile } from "../types";
import { useAuth } from "./useAuth";

export function useProfile() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["profile", session?.user.id, session?.user.phone],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      if (!session) {
        throw new Error("Войдите в аккаунт.");
      }

      return getProfileFromBazaar(session);
    }
  });
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
        const profile = await updateProfileInBazaar({
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
