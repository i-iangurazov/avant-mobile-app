import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StatusBadge } from "../../src/components/StatusBadge";
import { colors, radius, shadows, spacing, typography } from "../../src/constants/theme";
import { stores } from "../../src/data/stores";
import { useAuth } from "../../src/hooks/useAuth";
import { useOrder } from "../../src/hooks/useOrders";
import { formatDate, formatPrice, statusLabels, statusSteps } from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";
import type { OrderStatus } from "../../src/types";

const cleanOrderTitle = (orderNumber: string) => {
  if (!orderNumber || orderNumber.includes("unknown-order")) {
    return "Заказ оформлен";
  }

  return orderNumber.startsWith("Заказ") ? orderNumber : `Заказ ${orderNumber}`;
};

const resolveStore = (storeName?: string | null) => {
  if (!storeName) {
    return null;
  }

  const normalized = storeName.toLowerCase();
  return stores.find((store) => store.name.toLowerCase().includes(normalized) || normalized.includes(store.name.replace("Авантехник ", "").toLowerCase())) ?? null;
};

const pluralizeRu = (count: number, one: string, few: string, many: string) => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }
  return many;
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const order = useOrder(id);

  if (authLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <LoadingState text="Проверяем аккаунт..." />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScreenHeader title="Заказ" onBack={() => safeBack("/orders")} />
        <EmptyState
          title="Войдите в аккаунт"
          text="Детали заказа доступны после входа."
          icon="person-circle-outline"
          actionTitle="Войти"
          onAction={() => router.push("/login")}
        />
      </SafeAreaView>
    );
  }

  if (order.isLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <LoadingState text="Загружаем заказ..." />
      </SafeAreaView>
    );
  }

  if (order.isError || !order.data) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ErrorState message={order.error?.message ?? "Заказ не найден"} onRetry={() => void order.refetch()} />
      </SafeAreaView>
    );
  }

  const currentOrder = order.data;
  const currentStatus = currentOrder.status as OrderStatus;
  const currentStatusIndex = Math.max(0, statusSteps.indexOf(currentStatus));
  const title = cleanOrderTitle(currentOrder.order_number);
  const selectedStore = resolveStore(currentOrder.store?.name) ?? currentOrder.store;
  const itemsCount = currentOrder.item_count || currentOrder.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const positionsCount = currentOrder.order_items.length;
  const timelineEvents = currentOrder.order_status_events.length
    ? currentOrder.order_status_events
    : [{ id: "created", status: "created", label: statusLabels.created, created_at: currentOrder.created_at }];

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScreenHeader title={title} subtitle={formatDate(currentOrder.created_at)} onBack={() => safeBack("/orders")} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryIcon}>
              <Ionicons name="receipt-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>{title}</Text>
              <Text style={styles.summaryMeta}>
                {currentOrder.delivery_method === "pickup" ? "Самовывоз" : "Доставка"} · {itemsCount} {pluralizeRu(itemsCount, "товар", "товара", "товаров")}
              </Text>
            </View>
            <StatusBadge status={currentStatus} />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Итого</Text>
            <Text style={styles.summaryValue}>{formatPrice(currentOrder.total_amount, currentOrder.total_label ?? "Уточняется менеджером")}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Статус заказа</Text>
            <Text style={styles.cardSubtitle}>{statusLabels[currentStatus] ?? "Заказ создан"}</Text>
          </View>
          <View style={styles.timeline}>
            {statusSteps.map((step, index) => {
              const active = index <= currentStatusIndex && currentStatus !== "cancelled";
              const current = index === currentStatusIndex;
              return (
                <View key={step} style={styles.step}>
                  <View style={styles.stepMarkerWrap}>
                    <View style={[styles.stepMarker, active && styles.stepMarkerActive]}>
                      {active ? <Ionicons name="checkmark" size={14} color={colors.surface} /> : null}
                    </View>
                    {index < statusSteps.length - 1 ? (
                      <View style={[styles.stepLine, active && !current && styles.stepLineActive]} />
                    ) : null}
                  </View>
                  <Text style={[styles.stepText, active && styles.stepTextActive]}>{statusLabels[step]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>История</Text>
          </View>
          {timelineEvents.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.itemName}>{event.label}</Text>
              <Text style={styles.itemQty}>{formatDate(event.created_at)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Состав заказа</Text>
            <Text style={styles.cardSubtitle}>{positionsCount} {pluralizeRu(positionsCount, "позиция", "позиции", "позиций")}</Text>
          </View>
          {currentOrder.order_items.length ? (
            currentOrder.order_items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemQty}>{item.quantity} шт.</Text>
                </View>
                <Text style={styles.itemPrice}>{formatPrice(item.unit_price, item.unit_price_label ?? "Цена уточняется")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyInline}>
              <Ionicons name="cube-outline" size={18} color={colors.textSubtle} />
              <Text style={styles.emptyInlineText}>Состав заказа уточняет менеджер</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Получатель</Text>
          </View>
          <InfoRow label="Имя" value={currentOrder.customer_name || "Уточняется"} />
          <InfoRow label="Телефон" value={currentOrder.customer_phone || "Уточняется"} />
          {currentOrder.delivery_method === "pickup" ? (
            <>
              <InfoRow label="Получение" value="Самовывоз" />
              <InfoRow label="Магазин" value={selectedStore?.name ?? currentOrder.store?.name ?? "Уточняется"} />
              <Text style={styles.infoMuted}>{selectedStore?.address ?? currentOrder.store?.address ?? "Адрес магазина уточнит менеджер"}</Text>
            </>
          ) : (
            <InfoRow label="Доставка" value={currentOrder.delivery_address || "Адрес уточняется"} />
          )}
          {currentOrder.comment ? <Text style={styles.infoMuted}>Комментарий: {currentOrder.comment}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 118,
    gap: spacing.md
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  summaryText: {
    flex: 1,
    gap: 3
  },
  summaryTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900"
  },
  summaryMeta: {
    color: colors.textSubtle,
    fontSize: typography.small,
    fontWeight: "700"
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "700"
  },
  summaryValue: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900",
    textAlign: "right"
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900"
  },
  cardSubtitle: {
    color: colors.textSubtle,
    fontSize: typography.small,
    marginTop: 3
  },
  timeline: {
    gap: spacing.sm
  },
  step: {
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 30
  },
  stepMarkerWrap: {
    alignItems: "center"
  },
  stepMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  stepMarkerActive: {
    backgroundColor: colors.primary
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 3
  },
  stepLineActive: {
    backgroundColor: colors.primary
  },
  stepText: {
    flex: 1,
    color: colors.textSubtle,
    fontSize: typography.small,
    fontWeight: "700",
    paddingTop: 2
  },
  stepTextActive: {
    color: colors.text
  },
  eventRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs
  },
  itemRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  itemInfo: {
    flex: 1
  },
  itemName: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800"
  },
  itemQty: {
    color: colors.textSubtle,
    fontSize: typography.small,
    marginTop: 3
  },
  itemPrice: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900"
  },
  emptyInline: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  emptyInlineText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "700"
  },
  infoRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "700"
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900",
    textAlign: "right"
  },
  infoMuted: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 19
  }
});
