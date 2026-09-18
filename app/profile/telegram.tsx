import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { useCreateTelegramLink, useTelegramLink, useUpdateTelegramPreferences } from "../../src/hooks/useProgram";
import { safeBack } from "../../src/lib/navigation/safeBack";

const choices = [
  ["loyalty", "Бонусы, уровень и награды"],
  ["leads", "Заявки клиентов"],
  ["reservations", "Резервы и готовность"],
  ["content", "Акции и обучение"]
] as const;

export default function TelegramSettingsScreen() {
  const { user } = useAuth();
  const link = useTelegramLink();
  const createLink = useCreateTelegramLink();
  const update = useUpdateTelegramPreferences();
  const [enabled, setEnabled] = useState(true);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [command, setCommand] = useState<string | null>(null);

  useEffect(() => {
    if (!link.data) return;
    setEnabled(link.data.notificationsEnabled);
    setPreferences(link.data.preferences);
  }, [link.data]);

  if (!user) return <SafeAreaView style={styles.safe}><EmptyState title="Войдите в аккаунт" actionTitle="Войти" onAction={() => router.replace("/login")} /></SafeAreaView>;
  if (link.isLoading) return <SafeAreaView style={styles.safe}><LoadingState text="Проверяем Telegram..." /></SafeAreaView>;
  if (link.isError) return <SafeAreaView style={styles.safe}><ErrorState message={link.error.message} onRetry={() => void link.refetch()} /></SafeAreaView>;

  const connect = async () => {
    try {
      const token = await createLink.mutateAsync();
      setCommand(token.command);
      if (token.url) await Linking.openURL(token.url);
      else Alert.alert("Откройте бота", `Отправьте ему команду:\n${token.command}\n\nКод действует 10 минут и только один раз.`);
    } catch (error) { Alert.alert("Не удалось создать ссылку", error instanceof Error ? error.message : "Попробуйте ещё раз."); }
  };

  return <SafeAreaView edges={["top"]} style={styles.safe}><ScreenHeader title="Telegram" subtitle="Безопасные уведомления бота" onBack={() => safeBack("/profile")} /><ScrollView contentContainerStyle={styles.content}>
    <View style={[styles.statusCard, link.data?.connected ? styles.connected : styles.disconnected]}><Ionicons name={link.data?.connected ? "checkmark-circle" : "paper-plane-outline"} size={42} color={link.data?.connected ? colors.success : colors.secondary} /><View style={styles.flex}><Text style={styles.statusTitle}>{link.data?.connected ? "Telegram подключён" : "Telegram не подключён"}</Text><Text style={styles.statusText}>{link.data?.connected ? (link.data.username ? `@${link.data.username}` : "Связь с ботом подтверждена") : "Подключение выполняется одноразовой командой в личном чате с ботом."}</Text></View></View>
    {!link.data?.connected ? <AppButton title="Подключить Telegram" loading={createLink.isPending} onPress={() => void connect()} icon={<Ionicons name="paper-plane" size={19} color={colors.surface} />} /> : null}
    {command ? <View style={styles.commandCard}><Text style={styles.commandLabel}>Если бот не открылся, отправьте команду:</Text><Text selectable style={styles.command}>{command}</Text><Text style={styles.expiry}>Код одноразовый и действует 10 минут.</Text></View> : null}
    {link.data?.connected ? <View style={styles.settings}><View style={styles.mainSwitch}><View style={styles.flex}><Text style={styles.settingTitle}>Получать уведомления</Text><Text style={styles.settingText}>Ошибки Telegram не влияют на работу приложения.</Text></View><Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: colors.secondary }} /></View>{choices.map(([key, label]) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: preferences[key] !== false }} key={key} onPress={() => setPreferences((current) => ({ ...current, [key]: current[key] === false }))} style={styles.choice}><Ionicons name={preferences[key] === false ? "square-outline" : "checkbox"} size={22} color={preferences[key] === false ? colors.textSubtle : colors.secondary} /><Text style={styles.choiceText}>{label}</Text></Pressable>)}<AppButton title="Сохранить настройки" loading={update.isPending} onPress={() => void update.mutateAsync({ notificationsEnabled: enabled, preferences }).then(() => Alert.alert("Сохранено", "Настройки уведомлений обновлены.")).catch((error) => Alert.alert("Не удалось сохранить", error instanceof Error ? error.message : "Попробуйте ещё раз."))} /><AppButton title="Проверить подключение" variant="ghost" onPress={() => void link.refetch()} /></View> : null}
    <Text style={styles.privacy}>Бот не отправляет полный адрес клиента, данные чеков или другую чувствительную информацию. Подробности доступны только после входа в приложение.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }, statusCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1 }, connected: { backgroundColor: colors.successSoft, borderColor: "#A7F3D0" }, disconnected: { backgroundColor: colors.secondarySoft, borderColor: colors.secondarySoftBorder }, flex: { flex: 1 }, statusTitle: { color: colors.text, fontSize: typography.subheading, fontWeight: "900" }, statusText: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19, marginTop: 4 }, commandCard: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface }, commandLabel: { color: colors.textMuted, fontSize: typography.small }, command: { color: colors.secondary, fontSize: typography.body, fontWeight: "900" }, expiry: { color: colors.warning, fontSize: typography.tiny }, settings: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface }, mainSwitch: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, settingTitle: { color: colors.text, fontSize: typography.body, fontWeight: "900" }, settingText: { color: colors.textSubtle, fontSize: typography.tiny, marginTop: 3 }, choice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 40 }, choiceText: { color: colors.text, fontSize: typography.small, fontWeight: "700" }, privacy: { color: colors.textSubtle, fontSize: typography.tiny, lineHeight: 16, textAlign: "center", paddingHorizontal: spacing.lg } });
