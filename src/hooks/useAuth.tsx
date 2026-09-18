import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { Platform } from "react-native";
import { getCustomerProfile, loginCustomer, registerCustomer } from "../lib/api/account";
import type { AppCustomer, AppCustomerSession, RegisterCustomerPayload } from "../lib/api/types";
import { friendlyError, normalizePhone } from "../lib/formatters";

type SignUpPayload = RegisterCustomerPayload;

type AuthContextValue = {
  session: AppCustomerSession | null;
  user: AppCustomer | null;
  isLoading: boolean;
  signIn: (phone: string, password: string) => Promise<AppCustomer>;
  signUp: (payload: SignUpPayload) => Promise<{ needsLogin: boolean }>;
  updateSessionUser: (user: AppCustomer) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STORAGE_KEY = "avantehnik.app-session.v1";
const LEGACY_AUTH_STORAGE_KEY = "avantehnik.bazaar-session.v1";

const storage = {
  async getItem(key: string) {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  }
};

const parseSession = (value: string | null): AppCustomerSession | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as AppCustomerSession;
    return parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AppCustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([storage.getItem(AUTH_STORAGE_KEY), storage.getItem(LEGACY_AUTH_STORAGE_KEY)])
      .then(async ([storedSession, legacySession]) => {
        const sessionToRestore = storedSession || legacySession;
        const restored = parseSession(sessionToRestore);
        if (mounted) {
          setSession(restored);
        }
        if (!storedSession && legacySession) {
          await storage.setItem(AUTH_STORAGE_KEY, legacySession);
          await storage.removeItem(LEGACY_AUTH_STORAGE_KEY);
        }
        if (restored?.accessToken) {
          try {
            const refreshedUser = await getCustomerProfile(restored);
            const refreshed = { ...restored, user: refreshedUser };
            if (mounted) setSession(refreshed);
            await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshed));
          } catch {
            // Keep the cached session for offline startup; authenticated requests still enforce server access.
          }
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const persistSession = useCallback(async (nextSession: AppCustomerSession | null) => {
    setSession(nextSession);

    if (nextSession) {
      await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    } else {
      await storage.removeItem(AUTH_STORAGE_KEY);
    }
    await storage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  }, []);

  const signIn = useCallback(
    async (phone: string, password: string) => {
      try {
        const nextSession = await loginCustomer({
          phone: normalizePhone(phone),
          password
        });
        await persistSession(nextSession);
        void queryClient.invalidateQueries();
        return nextSession.user;
      } catch (error) {
        throw new Error(friendlyError(error instanceof Error ? error.message : undefined));
      }
    },
    [persistSession, queryClient]
  );

  const signUp = useCallback(
    async ({ name, phone, address, password, accountType, plumberApplication }: SignUpPayload) => {
      try {
        const nextSession = await registerCustomer({
          name,
          phone: normalizePhone(phone),
          address,
          password,
          accountType,
          plumberApplication
        });
        await persistSession(nextSession);
        void queryClient.invalidateQueries();
        return { needsLogin: !nextSession.accessToken };
      } catch (error) {
        throw new Error(friendlyError(error instanceof Error ? error.message : undefined));
      }
    },
    [persistSession, queryClient]
  );

  const updateSessionUser = useCallback(
    async (user: AppCustomer) => {
      if (!session) {
        return;
      }

      await persistSession({
        ...session,
        user
      });
      void queryClient.invalidateQueries();
    },
    [persistSession, queryClient, session]
  );

  const signOut = useCallback(async () => {
    await persistSession(null);
    queryClient.clear();
  }, [persistSession, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signIn,
      signUp,
      updateSessionUser,
      signOut
    }),
    [isLoading, session, signIn, signOut, signUp, updateSessionUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
