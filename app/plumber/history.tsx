import { AppButton } from "../../src/components/AppButton";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../src/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { useLoyaltyHistory } from "../../src/hooks/useProgram";
import { formatBonus, loyaltyStatusLabels } from "../../src/lib/programFormat";
import { safeBack } from "../../src/lib/navigation/safeBack";

const filters = [
  { value: undefined, label: "Все" },
  { value: "pending", label: "Ожидает" },
  { value: "available", label: "Начислено" },
  { value: "spent", label: "Использовано" },
  { value: "reversed", label: "Возвраты" }
] as const;

export default function LoyaltyHistoryScreen() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string | undefined>();
  const history = useLoyaltyHistory({ status });
  const entries = history.data?.pages.flat() ?? [];

  if (!user || user.plumber?.applicationStatus !== "approved") return <SafeAreaView style={styles.safe}><EmptyState title="История недоступна" text="Она доступна подтверждённым сантехникам." actionTitle="Открыть профиль" onAction={() => router.replace("/profile")} /></SafeAreaView>;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <ScreenHeader title="История бонусов" subtitle="Все операции можно проверить" onBack={() => safeBack("/plumber-home")} />
      <View style={styles.filters}>{filters.map((filter) => <Pressable accessibilityRole="radio" aria-checked={status===filter.value} accessibilityState={{checked:status===filter.value}} key={filter.label} onPress={() => setStatus(filter.value)} style={[styles.filter, status === filter.value && styles.filterActive]}><Text style={[styles.filterText, status === filter.value && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}</View>
      {history.isLoading ? <LoadingState text="Загружаем операции..." /> : null}
      {history.isError ? <ErrorState message={history.error.message} onRetry={() => void history.refetch()} /> : null}
      {!history.isLoading && !history.isError && !entries.length ? <EmptyState title="Операций пока нет" text="Начисления появятся после обработки чека с вашим QR-кодом." icon="receipt-outline" /> : null}
      {entries.length ? <FlatList data={entries} ListFooterComponent={history.hasNextPage ? <AppButton title="Показать ещё" onPress={()=>void history.fetchNextPage()} loading={history.isFetchingNextPage} /> : null} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} onRefresh={() => void history.refetch()} refreshing={history.isRefetching} renderItem={({ item }) => {
        const outgoing = BigInt(item.amountMinor) < 0n || ["spent", "reversed", "cancelled"].includes(item.status);
        return <View style={styles.row}><View style={[styles.icon, outgoing ? styles.iconOut : styles.iconIn]}><Ionicons name={outgoing ? "arrow-down" : "arrow-up"} size={18} color={outgoing ? colors.danger : colors.success} /></View><View style={styles.copy}><Text style={styles.description}>{item.description}</Text><Text style={styles.meta}>{item.receiptNumber ? `Чек №${item.receiptNumber} · ` : ""}{new Date(item.createdAt).toLocaleDateString("ru-RU")}</Text>{item.status === "pending" && item.availableAt ? <Text style={styles.pending}>Станет доступно {new Date(item.availableAt).toLocaleDateString("ru-RU")}</Text> : null}</View><View style={styles.amountWrap}><Text style={[styles.amount, outgoing ? styles.amountOut : styles.amountIn]}>{formatBonus(item.amountMinor)}</Text><Text style={styles.status}>{loyaltyStatusLabels[item.status] ?? item.status}</Text></View></View>;
      }} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  filters: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  filterActive: { backgroundColor: colors.secondary },
  filterText: { color: colors.textMuted, fontSize: typography.tiny, fontWeight: "800" },
  filterTextActive: { color: colors.surface },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  icon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  iconIn: { backgroundColor: colors.successSoft }, iconOut: { backgroundColor: colors.dangerSoft },
  copy: { flex: 1 }, description: { color: colors.text, fontSize: typography.small, fontWeight: "900" },
  meta: { color: colors.textSubtle, fontSize: typography.tiny, marginTop: 3 }, pending: { color: colors.warning, fontSize: typography.tiny, fontWeight: "700", marginTop: 3 },
  amountWrap: { alignItems: "flex-end", maxWidth: 105 }, amount: { fontSize: typography.small, fontWeight: "900", textAlign: "right" },
  amountIn: { color: colors.success }, amountOut: { color: colors.danger }, status: { color: colors.textSubtle, fontSize: typography.tiny, marginTop: 3 }
});
