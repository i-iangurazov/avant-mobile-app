import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";
import { statusLabels } from "../lib/formatters";
import type { Availability, OrderStatus } from "../types";

type StatusBadgeProps = {
  status: Availability | OrderStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const isInStock = status === "in_stock";
  const isPreorder = status === "preorder";
  const isDone = status === "completed";
  const isCancelled = status === "cancelled";
  const isActive = ["created", "confirmed", "assembling", "ready_for_pickup", "on_the_way"].includes(status);

  const label = isInStock
    ? "В наличии"
    : isPreorder
      ? "Уточнить"
      : statusLabels[status as OrderStatus] ?? "Нет в наличии";
  const badgeStyle = isInStock || isDone
    ? styles.success
    : isCancelled
      ? styles.danger
    : isPreorder
      ? styles.neutral
      : isActive
        ? styles.primary
        : styles.neutral;

  return (
    <View style={[styles.badge, badgeStyle]}>
      <Text
        style={[
          styles.text,
          isInStock || isDone
            ? styles.successText
            : isCancelled
              ? styles.dangerText
              : isActive
                ? styles.primaryText
                : styles.neutralText
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5
  },
  text: {
    fontSize: typography.tiny,
    fontWeight: "800"
  },
  success: {
    backgroundColor: colors.successSoft
  },
  successText: {
    color: colors.success
  },
  primary: {
    backgroundColor: colors.primarySoft
  },
  primaryText: {
    color: colors.primary
  },
  neutral: {
    backgroundColor: colors.surfaceMuted
  },
  neutralText: {
    color: colors.textMuted
  },
  danger: {
    backgroundColor: colors.dangerSoft
  },
  dangerText: {
    color: colors.danger
  }
});
