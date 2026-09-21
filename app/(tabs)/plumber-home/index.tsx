import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../src/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../src/components/EmptyState";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { colors, radius, shadows, spacing, typography } from "../../../src/constants/theme";
import { useAuth } from "../../../src/hooks/useAuth";
import { usePlumberDashboard } from "../../../src/hooks/useProgram";
import { formatBonus, formatMinor, plumberStatusLabels } from "../../../src/lib/programFormat";

const quickActions = [
  { title: "Наличие", icon: "grid-outline", route: "/catalog", color: colors.secondary },
  { title: "Мой QR", icon: "qr-code-outline", route: "/plumber/qr", color: colors.primary },
  { title: "Награды", icon: "gift-outline", route: "/plumber/rewards", color: colors.secondary },
  { title: "Заявки", icon: "people-outline", route: "/leads", color: colors.primary }
] as const;

export default function PlumberDashboardScreen() {
  const { user } = useAuth();
  const dashboard = usePlumberDashboard();

  if (!user) return <SafeAreaView style={styles.safe}><EmptyState title="Войдите в аккаунт" actionTitle="Войти" onAction={() => router.replace("/login")} /></SafeAreaView>;
  if (user.plumber?.applicationStatus !== "approved") {
    return <SafeAreaView style={styles.safe}><EmptyState title="Кабинет пока недоступен" text="Подайте анкету или дождитесь подтверждения команды Авантехник." icon="shield-outline" actionTitle="Открыть анкету" onAction={() => router.push("/plumber/apply")} /></SafeAreaView>;
  }
  if (dashboard.isLoading) return <SafeAreaView style={styles.safe}><LoadingState text="Готовим рабочий кабинет..." /></SafeAreaView>;
  if (dashboard.isError || !dashboard.data) return <SafeAreaView style={styles.safe}><ErrorState message={dashboard.error?.message} onRetry={() => void dashboard.refetch()} /></SafeAreaView>;

  const data = dashboard.data;
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>РАБОЧИЙ КАБИНЕТ</Text>
            <Text style={styles.title}>{data.plumber.fullName}</Text>
            <View style={styles.verified}><Ionicons name="shield-checkmark" size={15} color={colors.success} /><Text style={styles.verifiedText}>{plumberStatusLabels[data.plumber.applicationStatus]}</Text></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Открыть QR-код" onPress={() => router.push("/plumber/qr")} style={styles.qrButton}>
            <Ionicons name="qr-code" size={28} color={colors.surface} />
          </Pressable>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View><Text style={styles.balanceLabel}>Доступно</Text><Text style={styles.balanceValue}>{formatBonus(data.balances.availableMinor)}</Text></View>
            <View style={styles.levelPill}><Text style={styles.levelPillText}>{data.level.current.name}</Text></View>
          </View>
          <View style={styles.pendingRow}><Ionicons name="time-outline" size={17} color={colors.warning} /><Text style={styles.pendingText}>Ожидает: {formatBonus(data.balances.pendingMinor)}</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${data.level.progressPercent}%` }]} /></View>
          <View style={styles.progressCopy}>
            <Text style={styles.progressText}>{formatMinor(data.level.eligiblePurchaseMinor)} за {data.level.rollingPeriodDays} дней</Text>
            <Text style={styles.progressStrong}>{data.level.next ? `До «${data.level.next.name}»: ${formatMinor(data.level.remainingMinor)}` : "Максимальный уровень"}</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          {quickActions.map((action) => (
            <Pressable key={action.title} accessibilityRole="button" onPress={() => router.push(action.route as never)} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
              <View style={[styles.quickIcon, { backgroundColor: action.color === colors.primary ? colors.primarySoft : colors.secondarySoft }]}><Ionicons name={action.icon} size={24} color={action.color} /></View>
              <Text style={styles.quickText}>{action.title}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.metricRow}>
          <Metric icon="bookmark-outline" value={data.activeReservationsCount} label="Активные резервы" onPress={() => router.push("/orders")} />
          <Metric icon="notifications-outline" value={data.newLeadsCount} label="Новые заявки" onPress={() => router.push("/leads")} />
          <Metric icon="star-outline" value={data.plumber.rating ?? "—"} label={`${data.plumber.reviewsCount} отзывов`} onPress={() => router.push("/plumber/reviews")} />
        </View>

        <SectionTitle title="Последние покупки" action="Вся история" onPress={() => router.push("/plumber/history")} />
        <View style={styles.listCard}>
          {data.recentPurchases.length ? data.recentPurchases.map((purchase) => (
            <View key={purchase.id} style={styles.purchaseRow}>
              <View style={styles.purchaseIcon}><Ionicons name="receipt-outline" size={20} color={colors.secondary} /></View>
              <View style={styles.rowCopy}><Text style={styles.rowTitle}>Чек №{purchase.receiptNumber}</Text><Text style={styles.rowSubtitle}>{purchase.storeName || "Магазин Авантехник"} · {new Date(purchase.purchaseAt).toLocaleDateString("ru-RU")}</Text></View>
              <Text style={styles.rowAmount}>{formatMinor(purchase.totalMinor)}</Text>
            </View>
          )) : <View style={styles.inlineEmpty}><Ionicons name="receipt-outline" size={30} color={colors.textSubtle} /><Text style={styles.inlineEmptyText}>Покупки появятся после сканирования QR-кода на кассе.</Text></View>}
        </View>

        <SectionTitle title="Акции для мастеров" action="Все материалы" onPress={() => router.push("/plumber/content")} />
        {data.promotions.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promotions}>
            {data.promotions.map((promotion) => (
              <Pressable key={promotion.id} onPress={() => router.push("/plumber/content")} style={styles.promoCard}>
                {promotion.imageUrl ? <Image source={{ uri: promotion.imageUrl }} style={styles.promoImage} /> : <View style={styles.promoPlaceholder}><Text style={styles.multiplier}>×{promotion.multiplier}</Text></View>}
                <Text style={styles.promoTitle} numberOfLines={2}>{promotion.title}</Text>
                <Text style={styles.promoDate}>до {new Date(promotion.endsAt).toLocaleDateString("ru-RU")}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : <View style={styles.listCard}><View style={styles.inlineEmpty}><Ionicons name="megaphone-outline" size={30} color={colors.textSubtle} /><Text style={styles.inlineEmptyText}>Активных промо сейчас нет. Мы сообщим о новых предложениях.</Text></View></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ icon, value, label, onPress }: { icon: string; value: string | number; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.metric}><Ionicons name={icon as never} size={21} color={colors.primary} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Pressable>;
}

function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text><Pressable accessibilityRole="button" onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.secondary, fontSize: typography.tiny, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: typography.title, fontWeight: "900", marginTop: 3 },
  verified: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  verifiedText: { color: colors.success, fontSize: typography.small, fontWeight: "800" },
  qrButton: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  balanceCard: { margin: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.secondary, padding: spacing.xl, gap: spacing.md, ...shadows.card },
  balanceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  balanceLabel: { color: "#D8EBFF", fontSize: typography.small, fontWeight: "700" },
  balanceValue: { color: colors.surface, fontSize: 27, fontWeight: "900", marginTop: 2 },
  levelPill: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  levelPillText: { color: colors.surface, fontSize: typography.small, fontWeight: "900" },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  pendingText: { color: "#FFE4B5", fontSize: typography.small, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primary },
  progressCopy: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  progressText: { flex: 1, color: "#D8EBFF", fontSize: typography.tiny },
  progressStrong: { flex: 1, color: colors.surface, fontSize: typography.tiny, fontWeight: "800", textAlign: "right" },
  quickGrid: { paddingHorizontal: spacing.lg, flexDirection: "row", gap: spacing.sm },
  quickCard: { flex: 1, minHeight: 94, backgroundColor: colors.surface, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: spacing.sm, ...shadows.card },
  quickIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  quickText: { color: colors.text, fontSize: typography.tiny, fontWeight: "900" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  metricRow: { padding: spacing.lg, flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, minHeight: 110, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  metricValue: { color: colors.text, fontSize: typography.heading, fontWeight: "900", marginTop: 3 },
  metricLabel: { color: colors.textMuted, fontSize: typography.tiny, lineHeight: 15 },
  sectionTitleRow: { paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: typography.subheading, fontWeight: "900" },
  sectionAction: { color: colors.primary, fontSize: typography.small, fontWeight: "800" },
  listCard: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", ...shadows.card },
  purchaseRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  purchaseIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.secondarySoft, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: typography.small, fontWeight: "900" },
  rowSubtitle: { color: colors.textSubtle, fontSize: typography.tiny, marginTop: 3 },
  rowAmount: { color: colors.secondary, fontSize: typography.small, fontWeight: "900" },
  inlineEmpty: { minHeight: 110, padding: spacing.lg, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  inlineEmptyText: { color: colors.textMuted, fontSize: typography.small, textAlign: "center", lineHeight: 19 },
  promotions: { paddingHorizontal: spacing.lg, gap: spacing.md },
  promoCard: { width: 210, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadows.card },
  promoImage: { width: "100%", height: 90, borderRadius: radius.md, marginBottom: spacing.sm },
  promoPlaceholder: { height: 90, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  multiplier: { color: colors.primary, fontSize: 34, fontWeight: "900" },
  promoTitle: { color: colors.text, fontSize: typography.small, fontWeight: "900" },
  promoDate: { color: colors.textSubtle, fontSize: typography.tiny, marginTop: 4 }
});
