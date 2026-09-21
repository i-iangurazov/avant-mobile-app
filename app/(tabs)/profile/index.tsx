import {plumberStatusLabels} from "../../../src/lib/programFormat";
import {LegalLinks} from "../../../src/components/LegalLinks";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../src/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../src/components/AppButton";
import { EmptyState } from "../../../src/components/EmptyState";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { colors, radius, shadows, spacing, typography } from "../../../src/constants/theme";
import { useAuth } from "../../../src/hooks/useAuth";
import { useProfile } from "../../../src/hooks/useProfile";
import { friendlyError } from "../../../src/lib/formatters";
import { openWhatsApp } from "../../../src/lib/whatsapp";

const baseActions = [
  { title: "Удалить аккаунт", icon: "trash-outline", route: "/delete-account" },
  { title: "Редактировать профиль", icon: "create-outline", route: "/profile/edit" },
  { title: "Telegram-уведомления", icon: "paper-plane-outline", route: "/profile/telegram" },
  { title: "Поддержка", icon: "chatbubble-ellipses-outline" },
  { title: "О приложении", icon: "information-circle-outline", route: "/profile/about" }
];

export default function ProfileScreen() {
  const profile = useProfile();
  const { signOut, user } = useAuth();

  const logout = async () => {
    try {
      await signOut();
      router.replace("/welcome");
    } catch (error) {
      Alert.alert("Не удалось выйти", friendlyError(error instanceof Error ? error.message : undefined));
    }
  };

  const onAction = (action: (typeof baseActions)[number]) => {
    if (action.route) {
      router.push(action.route as never);
      return;
    }
    if (action.title === "Поддержка") {
      void openWhatsApp("Здравствуйте! Мне нужна помощь с заказом.").catch((error) => {
        Alert.alert("WhatsApp", friendlyError(error instanceof Error ? error.message : undefined));
      });
    }
  };

  if (!user) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Профиль</Text>
          <Text style={styles.subtitle}>Данные покупателя и поддержка</Text>
        </View>
        <View style={styles.unauthBody}>
          <EmptyState
            title="Войдите в аккаунт"
            text="Профиль будет доступен после входа в аккаунт Авантехник."
            icon="person-circle-outline"
            actionTitle="Войти"
            onAction={() => router.push({ pathname: "/login", params: { returnTo: "/profile" } })}
          />
          <View style={styles.supportWrap}>
            <LegalLinks />
            <AppButton
              title="Написать в WhatsApp"
              variant="secondary"
              onPress={() =>
                void openWhatsApp("Здравствуйте! Мне нужна помощь с заказом.").catch((error) => {
                  Alert.alert("WhatsApp", friendlyError(error instanceof Error ? error.message : undefined));
                })
              }
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (profile.isLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <LoadingState text="Загружаем профиль..." />
      </SafeAreaView>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ErrorState message={profile.error?.message ?? "Профиль не найден"} onRetry={() => void profile.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Профиль</Text>
          <Text style={styles.subtitle}>Данные покупателя и настройки</Text>
        </View>

        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={30} color={colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{profile.data.name}</Text>
            <Text style={styles.phone}>{profile.data.phone}</Text>
            <Text style={styles.address}>{profile.data.address ?? "Адрес не указан"}</Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push(user.plumber?.applicationStatus === "approved" ? "/plumber-home" : "/plumber/apply")} style={styles.programCard}><View style={styles.programIcon}><Ionicons name={user.plumber?.applicationStatus === "approved" ? "shield-checkmark" : "construct-outline"} size={26} color={colors.surface} /></View><View style={styles.userInfo}><Text style={styles.programTitle}>{user.plumber?.applicationStatus === "approved" ? "Кабинет сантехника" : user.plumber ? "Анкета сантехника" : "Стать сантехником"}</Text><Text style={styles.programText}>{user.plumber?.applicationStatus === "approved" ? `${user.plumber.loyaltyCode} · бонусы, QR и заявки` : user.plumber ? `Статус: ${plumberStatusLabels[user.plumber.applicationStatus]}` : "Один аккаунт для покупок и программы лояльности"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.surface} /></Pressable>

        {user.plumber?.applicationStatus === "approved" ? <View style={styles.actions}>{[{ title: "История бонусов", icon: "receipt-outline", route: "/plumber/history" }, { title: "Награды", icon: "gift-outline", route: "/plumber/rewards" }, { title: "Акции и обучение", icon: "school-outline", route: "/plumber/content" }, { title: "Отзывы клиентов", icon: "star-outline", route: "/plumber/reviews" }].map((action) => <Pressable key={action.title} accessibilityRole="button" onPress={() => router.push(action.route as never)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Ionicons name={action.icon as never} size={20} color={colors.secondary} /></View><Text style={styles.actionText}>{action.title}</Text><Ionicons name="chevron-forward" size={18} color={colors.textSubtle} /></Pressable>)}</View> : null}

        {user.isAdmin ? <Pressable accessibilityRole="button" onPress={() => router.push("/admin")} style={styles.adminCard}><Ionicons name="settings-outline" size={24} color={colors.primary} /><View style={styles.userInfo}><Text style={styles.adminTitle}>Управление программой</Text><Text style={styles.adminText}>Анкеты, чеки, заявки и настройки</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primary} /></Pressable> : null}

        <View style={styles.actions}>
          {baseActions.map((action) => (
            <Pressable
              key={action.title}
              accessibilityRole="button"
              onPress={() => onAction(action)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={action.icon as never} size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionText}>{action.title}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>
          ))}
        </View>

        <AppButton title="Выйти" variant="danger" onPress={() => void logout()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingBottom: spacing.xl
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textSubtle,
    fontSize: typography.small,
    fontWeight: "700",
    marginTop: 2
  },
  userCard: {
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    ...shadows.card
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  userInfo: {
    flex: 1,
    gap: 4
  },
  name: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900"
  },
  phone: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "700"
  },
  address: {
    color: colors.textSubtle,
    fontSize: typography.small
  },
  actions: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.card
  },
  programCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.secondary, borderRadius: radius.xl, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, ...shadows.card },
  programIcon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,.16)", alignItems: "center", justifyContent: "center" },
  programTitle: { color: colors.surface, fontSize: typography.subheading, fontWeight: "900" },
  programText: { color: "#D8EBFF", fontSize: typography.tiny, lineHeight: 16, marginTop: 3 },
  adminCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#FFD0C5", borderRadius: radius.xl, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  adminTitle: { color: colors.primary, fontSize: typography.body, fontWeight: "900" },
  adminText: { color: colors.textMuted, fontSize: typography.tiny, marginTop: 3 },
  action: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  actionText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800"
  },
  pressed: {
    backgroundColor: colors.surfaceMuted
  },
  unauthBody: {
    flex: 1,
    paddingBottom: spacing.xl
  },
  supportWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg
  }
});
