import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Alert, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, shadows, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { usePlumberDashboard, useRedeemReward, useRewards } from "../../src/hooks/useProgram";
import { formatBonus } from "../../src/lib/programFormat";
import { safeBack } from "../../src/lib/navigation/safeBack";
import type { LoyaltyReward } from "../../src/types";

export default function RewardsScreen() {
  const { user } = useAuth();
  const rewards = useRewards();
  const dashboard = usePlumberDashboard();
  const redeem = useRedeemReward();

  if (!user || user.plumber?.applicationStatus !== "approved") return <SafeAreaView style={styles.safe}><EmptyState title="Награды недоступны" text="Дождитесь подтверждения анкеты сантехника." actionTitle="Открыть профиль" onAction={() => router.replace("/profile")} /></SafeAreaView>;

  const confirm = (reward: LoyaltyReward) => Alert.alert(
    "Обменять бонусы?",
    `${reward.title}\nСтоимость: ${formatBonus(reward.costMinor)}. После подтверждения заявка поступит администратору.`,
    [
      { text: "Отмена", style: "cancel" },
      { text: "Подтвердить", onPress: () => void redeem.mutateAsync({ rewardId: reward.id, clientRequestId: `reward_${Date.now()}_${Math.random().toString(36).slice(2)}` }).then(() => Alert.alert("Заявка создана", "Статус выдачи появится после обработки администратором.")).catch((error) => Alert.alert("Не удалось обменять", error instanceof Error ? error.message : "Попробуйте ещё раз.")) }
    ]
  );

  return <SafeAreaView edges={["top"]} style={styles.safe}>
    <ScreenHeader title="Награды" subtitle={`Доступно: ${formatBonus(dashboard.data?.balances.availableMinor ?? 0)}`} onBack={() => safeBack("/plumber-home")} />
    {rewards.isLoading ? <LoadingState text="Загружаем награды..." /> : null}
    {rewards.isError ? <ErrorState message={rewards.error.message} onRetry={() => void rewards.refetch()} /> : null}
    {!rewards.isLoading && !rewards.isError && !rewards.data?.length ? <EmptyState title="Каталог готовится" text="Инструменты, сертификаты и другие награды появятся после настройки администратором." icon="gift-outline" /> : null}
    {rewards.data?.length ? <FlatList data={rewards.data} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => {
      const enough = BigInt(dashboard.data?.balances.availableMinor ?? 0) >= BigInt(item.costMinor);
      const available = item.availabilityCount === null || item.availabilityCount === undefined || item.availabilityCount > 0;
      return <View style={styles.card}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <View style={styles.placeholder}><Ionicons name="gift" size={42} color={colors.primary} /></View>}<View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.description}>{item.description}</Text>{item.conditions ? <Text style={styles.conditions}>{item.conditions}</Text> : null}<Text style={styles.cost}>{formatBonus(item.costMinor)}</Text><AppButton title={!available ? "Нет в наличии" : enough ? "Обменять бонусы" : "Недостаточно бонусов"} disabled={!available || !enough || redeem.isPending} loading={redeem.isPending && redeem.variables?.rewardId === item.id} onPress={() => confirm(item)} /></View></View>;
    }} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, list: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }, card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: "hidden", ...shadows.card }, image: { width: "100%", height: 170 }, placeholder: { height: 130, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }, copy: { padding: spacing.lg, gap: spacing.sm }, title: { color: colors.text, fontSize: typography.subheading, fontWeight: "900" }, description: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 }, conditions: { color: colors.textSubtle, fontSize: typography.tiny, lineHeight: 16 }, cost: { color: colors.secondary, fontSize: typography.heading, fontWeight: "900", marginBottom: spacing.xs } });
