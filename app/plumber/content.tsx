import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Alert, FlatList, Image, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../src/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, shadows, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { useProgramContent, useRegisterForTraining } from "../../src/hooks/useProgram";
import { safeBack } from "../../src/lib/navigation/safeBack";

const contentLabels: Record<string, string> = { promotion: "Акция", new_product: "Новинка", training: "Обучение", master_day: "День мастера", material: "Материал" };

export default function ProgramContentScreen() {
  const { user } = useAuth();
  const content = useProgramContent();
  const registration = useRegisterForTraining();
  if (!user || user.plumber?.applicationStatus !== "approved") return <SafeAreaView style={styles.safe}><EmptyState title="Материалы недоступны" actionTitle="Открыть профиль" onAction={() => router.replace("/profile")} /></SafeAreaView>;
  return <SafeAreaView edges={["top", "bottom"]} style={styles.safe}><ScreenHeader title="Для мастеров" subtitle="Акции, новинки и обучение" onBack={() => safeBack("/plumber-home")} />
    {content.isLoading ? <LoadingState text="Загружаем материалы..." /> : null}
    {content.isError ? <ErrorState message={content.error.message} onRetry={() => void content.refetch()} /> : null}
    {!content.isLoading && !content.isError && !content.data?.length ? <EmptyState title="Новостей пока нет" text="Акции и события появятся после публикации командой Авантехник." icon="megaphone-outline" /> : null}
    {content.data?.length ? <FlatList data={content.data} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => {
      const registrable = ["training", "master_day"].includes(item.type);
      return <View style={styles.card}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <View style={styles.placeholder}><Ionicons name={registrable ? "school-outline" : "megaphone-outline"} size={38} color={colors.secondary} /></View>}<View style={styles.copy}><Text style={styles.badge}>{contentLabels[item.type] ?? item.type}</Text><Text style={styles.title}>{item.title}</Text><Text style={styles.description}>{item.description}</Text>{item.startsAt ? <Text style={styles.meta}>Дата: {new Date(item.startsAt).toLocaleString("ru-RU")}</Text> : null}{item.location ? <Text style={styles.meta}>Место: {item.location}</Text> : null}{registrable ? <AppButton title={item.registrationStatus === "registered" ? "Вы зарегистрированы" : "Зарегистрироваться"} disabled={item.registrationStatus === "registered" || registration.isPending} loading={registration.isPending && registration.variables === item.id} onPress={() => void registration.mutateAsync(item.id).then(() => Alert.alert("Готово", "Регистрация подтверждена.")).catch((error) => Alert.alert("Не удалось зарегистрироваться", error instanceof Error ? error.message : "Попробуйте ещё раз."))} /> : null}</View></View>;
    }} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, list: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }, card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: "hidden", ...shadows.card }, image: { width: "100%", height: 170 }, placeholder: { height: 120, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondarySoft }, copy: { padding: spacing.lg, gap: spacing.sm }, badge: { alignSelf: "flex-start", color: colors.secondary, fontSize: typography.tiny, fontWeight: "900", backgroundColor: colors.secondarySoft, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill }, title: { color: colors.text, fontSize: typography.subheading, fontWeight: "900" }, description: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 }, meta: { color: colors.textSubtle, fontSize: typography.small, fontWeight: "700" } });
