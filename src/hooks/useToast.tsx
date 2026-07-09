import Ionicons from "@expo/vector-icons/Ionicons";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";

type ToastVariant = "success" | "error" | "info";

type ToastState = {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: Omit<ToastState, "id">) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantMeta: Record<ToastVariant, { icon: string; color: string; background: string }> = {
  success: {
    icon: "checkmark-circle",
    color: colors.success,
    background: colors.successSoft
  },
  error: {
    icon: "alert-circle",
    color: colors.danger,
    background: colors.dangerSoft
  },
  info: {
    icon: "information-circle",
    color: colors.primary,
    background: colors.primarySoft
  }
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (nextToast: Omit<ToastState, "id">) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setToast({
        ...nextToast,
        id: Date.now()
      });

      timeoutRef.current = setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, 2600);
    },
    []
  );

  const value = useMemo(() => ({ showToast, hideToast }), [hideToast, showToast]);
  const meta = toast ? variantMeta[toast.variant] : null;

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {toast && meta ? (
          <Pressable accessibilityRole="button" onPress={hideToast} style={styles.toast}>
            <View style={[styles.iconWrap, { backgroundColor: meta.background }]}>
              <Ionicons name={meta.icon as never} size={21} color={meta.color} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{toast.title}</Text>
              {toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}
            </View>
            <Ionicons name="close" size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 112,
    minHeight: 62,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    zIndex: 1000,
    ...shadows.tabBar
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  textWrap: {
    flex: 1,
    gap: 2
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900"
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "600"
  }
});
