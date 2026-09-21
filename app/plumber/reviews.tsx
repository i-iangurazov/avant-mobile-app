import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../src/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { usePlumberReviews } from "../../src/hooks/useProgram";
import { safeBack } from "../../src/lib/navigation/safeBack";

export default function PlumberReviewsScreen() {
  const { user } = useAuth();
  const reviews = usePlumberReviews();
  if (!user || user.plumber?.applicationStatus !== "approved") return <SafeAreaView style={styles.safe}><EmptyState title="Отзывы недоступны" actionTitle="Открыть профиль" onAction={() => router.replace("/profile")} /></SafeAreaView>;
  return <SafeAreaView edges={["top"]} style={styles.safe}><ScreenHeader title="Отзывы клиентов" subtitle={`${user.plumber.rating ?? "—"} · ${user.plumber.reviewsCount} отзывов`} onBack={() => safeBack("/plumber-home")} />
    {reviews.isLoading ? <LoadingState text="Загружаем отзывы..." /> : null}
    {reviews.isError ? <ErrorState message={reviews.error.message} onRetry={() => void reviews.refetch()} /> : null}
    {!reviews.isLoading && !reviews.isError && !reviews.data?.length ? <EmptyState title="Отзывов пока нет" text="Клиент сможет оценить работу только после завершённой заявки." icon="star-outline" /> : null}
    {reviews.data?.length ? <FlatList data={reviews.data} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.card}><View style={styles.rating}>{Array.from({ length: 5 }, (_, index) => <Ionicons key={index} name={index < item.rating ? "star" : "star-outline"} size={17} color={colors.warning} />)}<Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</Text></View>{item.review ? <Text style={styles.review}>{item.review}</Text> : <Text style={styles.muted}>Оценка без комментария</Text>}{item.tags.length ? <View style={styles.tags}>{item.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View> : null}</View>} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }, card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, rating: { flexDirection: "row", alignItems: "center", gap: 2 }, date: { marginLeft: "auto", color: colors.textSubtle, fontSize: typography.tiny }, review: { color: colors.text, fontSize: typography.body, lineHeight: 21 }, muted: { color: colors.textSubtle, fontSize: typography.small }, tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, tag: { color: colors.secondary, fontSize: typography.tiny, fontWeight: "800", backgroundColor: colors.secondarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 } });
