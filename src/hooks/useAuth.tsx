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
import { loginCustomer, registerCustomer } from "../lib/bazaar/client";
import type { BazaarCustomer, BazaarCustomerSession } from "../lib/bazaar/types";
import { friendlyError, normalizePhone } from "../lib/formatters";

type SignUpPayload = {
  name: string;
  phone: string;
  address: string;
  password: string;
};

type AuthContextValue = {
  session: BazaarCustomerSession | null;
  user: BazaarCustomer | null;
  isLoading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<{ needsLogin: boolean }>;
  updateSessionUser: (user: BazaarCustomer) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STORAGE_KEY = "avantehnik:bazaar-session:v1";

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

const parseSession = (value: string | null): BazaarCustomerSession | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as BazaarCustomerSession;
    return parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<BazaarCustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    storage
      .getItem(AUTH_STORAGE_KEY)
      .then((storedSession) => {
        if (mounted) {
          setSession(parseSession(storedSession));
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

  const persistSession = useCallback(async (nextSession: BazaarCustomerSession | null) => {
    setSession(nextSession);

    if (nextSession) {
      await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    } else {
      await storage.removeItem(AUTH_STORAGE_KEY);
    }
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
      } catch (error) {
        throw new Error(friendlyError(error instanceof Error ? error.message : undefined));
      }
    },
    [persistSession, queryClient]
  );

  const signUp = useCallback(
    async ({ name, phone, address, password }: SignUpPayload) => {
      try {
        const nextSession = await registerCustomer({
          name,
          phone: normalizePhone(phone),
          address,
          password
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
    async (user: BazaarCustomer) => {
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

