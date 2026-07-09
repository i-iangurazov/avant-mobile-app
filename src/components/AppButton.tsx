import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";

type AppButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon
}: AppButtonProps) {
  const variantStyle = buttonVariants[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle.container,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.surface : colors.primary} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.title, variantStyle.title]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    title: {
      color: colors.surface
    }
  },
  secondary: {
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderWidth: 1.5
    },
    title: {
      color: colors.primary
    }
  },
  ghost: {
    container: {
      backgroundColor: "transparent",
      borderColor: "transparent"
    },
    title: {
      color: colors.textMuted
    }
  },
  danger: {
    container: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerSoft
    },
    title: {
      color: colors.danger
    }
  }
};

const styles = StyleSheet.create({
  button: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  title: {
    fontSize: typography.body,
    fontWeight: "700"
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9
  },
  disabled: {
    opacity: 0.55
  }
});
