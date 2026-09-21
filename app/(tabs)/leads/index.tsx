import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../src/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../src/components/AppButton";
import { EmptyState } from "../../../src/components/EmptyState";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { colors, radius, shadows, spacing, typography } from "../../../src/constants/theme";
import { useAuth } from "../../../src/hooks/useAuth";
import { usePlumberLeads, useUpdatePlumberLead } from "../../../src/hooks/useProgram";
import { leadStatusLabels } from "../../../src/lib/programFormat";
import type { ServiceRequest } from "../../../src/types";

export default function PlumberLeadsScreen() {
  const { user } = useAuth();
  const leads = usePlumberLeads();
  const update = useUpdatePlumberLead();
  if (!user || user.plumber?.applicationStatus !== "approved") return <SafeAreaView style={styles.safe}><EmptyState title="Заявки недоступны" text="Они доступны только подтверждённым сантехникам." actionTitle="Открыть анкету" onAction={() => router.push("/plumber/apply")} /></SafeAreaView>;

  const change = async (lead: ServiceRequest, status: "viewed" | "accepted" | "declined" | "in_progress" | "completed") => {
    try { await update.mutateAsync({ id: lead.id, status }); }
    catch (error) { Alert.alert("Статус не изменён", error instanceof Error ? error.message : "Заявку мог принять другой мастер."); }
  };

  return <SafeAreaView edges={["top"]} style={styles.safe}><View style={styles.header}><Text style={styles.title}>Заявки клиентов</Text><Text style={styles.subtitle}>Контакты откроются только после принятия</Text></View>
    {leads.isLoading ? <LoadingState text="Проверяем новые заявки..." /> : null}
    {leads.isError ? <ErrorState message={leads.error.message} onRetry={() => void leads.refetch()} /> : null}
    {!leads.isLoading && !leads.isError && !leads.data?.length ? <EmptyState title="Новых заявок нет" text="Администратор назначит подходящие заявки по району, специализации и качеству работы." icon="people-outline" /> : null}
    {leads.data?.length ? <FlatList data={leads.data} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} onRefresh={() => void leads.refetch()} refreshing={leads.isRefetching} renderItem={({ item }) => <Pressable onPress={() => item.status === "new" ? void change(item, "viewed") : undefined} style={styles.card}><View style={styles.top}><View style={styles.serviceIcon}><Ionicons name="construct-outline" size={22} color={colors.secondary} /></View><View style={styles.copy}><Text style={styles.service}>{item.serviceType}</Text><Text style={styles.district}>{item.district}{item.preferredAt ? ` · ${new Date(item.preferredAt).toLocaleString("ru-RU")}` : ""}</Text></View><Text style={[styles.status, item.status === "new" && styles.statusNew]}>{leadStatusLabels[item.status]}</Text></View><Text style={styles.description}>{item.description}</Text>{item.contact ? <View style={styles.contact}><Ionicons name="lock-open-outline" size={18} color={colors.success} /><View style={styles.contactCopy}><Text style={styles.contactTitle}>{item.contact.phone}</Text>{item.contact.address ? <Text style={styles.contactText}>{item.contact.address}</Text> : null}</View></View> : <View style={styles.private}><Ionicons name="lock-closed-outline" size={16} color={colors.textSubtle} /><Text style={styles.privateText}>Точный адрес и телефон скрыты до принятия заявки</Text></View>}<View style={styles.actions}>{["new", "viewed"].includes(item.status) ? <><View style={styles.action}><AppButton title="Принять" loading={update.isPending && update.variables?.id === item.id} onPress={() => void change(item, "accepted")} /></View><View style={styles.action}><AppButton title="Отклонить" variant="secondary" disabled={update.isPending} onPress={() => void change(item, "declined")} /></View></> : null}{item.status === "accepted" ? <AppButton title="Начать работу" loading={update.isPending} onPress={() => void change(item, "in_progress")} /> : null}{item.status === "in_progress" ? <AppButton title="Завершить работу" loading={update.isPending} onPress={() => void change(item, "completed")} /> : null}</View></Pressable>} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, header: { backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg }, title: { color: colors.text, fontSize: typography.title, fontWeight: "900" }, subtitle: { color: colors.textSubtle, fontSize: typography.small, fontWeight: "700", marginTop: 2 }, list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }, card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, ...shadows.card }, top: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, serviceIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.secondarySoft, alignItems: "center", justifyContent: "center" }, copy: { flex: 1 }, service: { color: colors.text, fontSize: typography.body, fontWeight: "900" }, district: { color: colors.textSubtle, fontSize: typography.tiny, marginTop: 3 }, status: { color: colors.textMuted, fontSize: typography.tiny, fontWeight: "800", backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill }, statusNew: { color: colors.primary, backgroundColor: colors.primarySoft }, description: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 }, private: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.surfaceMuted, padding: spacing.sm, borderRadius: radius.md }, privateText: { flex: 1, color: colors.textSubtle, fontSize: typography.tiny }, contact: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: spacing.md }, contactCopy: { flex: 1 }, contactTitle: { color: colors.text, fontSize: typography.small, fontWeight: "900" }, contactText: { color: colors.textMuted, fontSize: typography.small, marginTop: 3 }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 } });
