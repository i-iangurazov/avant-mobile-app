import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";
import { formatDate, formatPrice } from "../lib/formatters";
import type { OrderListItem } from "../types";
import { StatusBadge } from "./StatusBadge";

type OrderCardProps = {
  order: OrderListItem;
  onPress: () => void;
};

export function OrderCard({ order, onPress }: OrderCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.number}>{order.order_number}</Text>
          <Text style={styles.date}>{formatDate(order.created_at)}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.items}>{order.item_count} товаров</Text>
        <Text style={styles.total}>{formatPrice(order.total_amount, order.total_label ?? "Уточняется менеджером")}</Text>
        <View style={styles.more}>
          <Text style={styles.moreText}>Подробнее</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  number: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900"
  },
  date: {
    color: colors.textSubtle,
    fontSize: typography.small,
    marginTop: 3
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  items: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "700"
  },
  total: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900"
  },
  more: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  moreText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "800"
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92
  }
});
