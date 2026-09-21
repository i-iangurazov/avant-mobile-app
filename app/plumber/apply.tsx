import {appApiClient} from "../../src/lib/api/client";
import {PhotoAttachment} from "../../src/components/PhotoAttachment";
import {LegalLinks} from "../../src/components/LegalLinks";
import {useDocuments} from "../../src/hooks/useDocuments";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../src/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { AppInput } from "../../src/components/AppInput";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { usePlumberApplication, useSubmitPlumberApplication } from "../../src/hooks/useProgram";
import { friendlyError } from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";

const toList = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
const statusCopy = {
  pending: { icon: "time-outline", title: "Анкета на проверке", text: "Команда Авантехник проверит данные. Покупки и обычный профиль продолжают работать.", color: colors.warning },
  approved: { icon: "shield-checkmark-outline", title: "Сантехник подтверждён", text: "Вам доступны профессиональный кабинет, QR-код, бонусы и заявки клиентов.", color: colors.success },
  rejected: { icon: "alert-circle-outline", title: "Анкету нужно уточнить", text: "Исправьте данные и отправьте анкету повторно.", color: colors.danger },
  suspended: { icon: "pause-circle-outline", title: "Доступ приостановлен", text: "Обратитесь в поддержку Авантехник для уточнения. Покупательские функции доступны.", color: colors.danger }
} as const;

export default function PlumberApplicationScreen() {
  const { user, session } = useAuth();
  const application = usePlumberApplication();
  const submitApplication = useSubmitPlumberApplication();
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [city, setCity] = useState("Бишкек");
  const [districts, setDistricts] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [experience, setExperience] = useState("");
  const [description, setDescription] = useState("");
  const documents=useDocuments();
  const [photoUrl, setPhotoUrl] = useState("");
  const [programConsent, setProgramConsent] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const documentVersions=documents.data?.map(doc=>`${doc.kind}:${doc.version}`).join("|");
  useEffect(()=>{setProgramConsent(false);setDataConsent(false);},[documentVersions]);

  useEffect(() => {
    const profile = application.data;
    if (!profile) return;
    setFullName(profile.fullName);
    setCity(profile.city);
    setDistricts(profile.workingDistricts.join(", "));
    setSpecializations(profile.specializations.join(", "));
    setExperience(String(profile.experienceYears));
    setDescription(profile.description ?? "");
    setPhotoUrl(profile.profilePhotoUrl ?? "");
  }, [application.data]);

  if (!user) {
    return <SafeAreaView style={styles.safe}><EmptyState title="Войдите в аккаунт" text="Для анкеты используется существующий аккаунт — второй создавать не нужно." actionTitle="Войти" onAction={() => router.push("/login")} /></SafeAreaView>;
  }
  if (application.isLoading) return <SafeAreaView style={styles.safe}><LoadingState text="Проверяем анкету..." /></SafeAreaView>;
  if (application.isError) return <SafeAreaView style={styles.safe}><ErrorState message={application.error.message} onRetry={() => void application.refetch()} /></SafeAreaView>;

  const profile = application.data;
  if (profile && profile.applicationStatus !== "rejected") {
    const copy = statusCopy[profile.applicationStatus];
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Программа сантехников" onBack={() => safeBack("/profile")} />
        <View style={styles.statusBody}>
          <View style={styles.statusCard}>
            <Ionicons name={copy.icon} size={62} color={copy.color} />
            <Text style={styles.statusTitle}>{copy.title}</Text>
            <Text style={styles.statusText}>{copy.text}</Text>
            {profile.suspensionReason ? <Text style={styles.reason}>Причина: {profile.suspensionReason}</Text> : null}
          </View>
          <PhotoAttachment value={photoUrl} onChange={url=>{void appApiClient.request('/plumber/profile/photo',{method:'PATCH',headers:{Authorization:`Bearer ${session?.accessToken}`},body:JSON.stringify({url})}).then(()=>{setPhotoUrl(url);void application.refetch();}).catch(error=>Alert.alert('Фото',error.message));}} />
          {profile.applicationStatus === "approved" ? <AppButton title="Открыть кабинет" onPress={() => router.replace("/plumber-home")} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  const submit = async () => {
    const experienceYears = Number(experience || 0);
    if (!fullName.trim() || !toList(districts).length || !toList(specializations).length) {
      Alert.alert("Проверьте анкету", "Укажите имя, рабочие районы и специализации.");
      return;
    }
    if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80) {
      Alert.alert("Проверьте стаж", "Укажите количество полных лет от 0 до 80.");
      return;
    }
    if (!programConsent || !dataConsent) {
      Alert.alert("Нужно согласие", "Подтвердите правила программы и обработку данных анкеты.");
      return;
    }
    try {
      await submitApplication.mutateAsync({
        fullName: fullName.trim(),
        city: city.trim() || "Бишкек",
        workingDistricts: toList(districts),
        specializations: toList(specializations),
        experienceYears,
        profilePhotoUrl: photoUrl.trim() || null,
        description: description.trim() || null,
        programDocumentVersion:documents.data?.find(d=>d.kind==="loyalty")?.version,
        privacyDocumentVersion:documents.data?.find(d=>d.kind==="privacy")?.version,
        programConsent,
        dataProcessingConsent: dataConsent
      });
      Alert.alert("Заявка отправлена", "Мы сообщим о результате в приложении и Telegram после подключения.");
      router.replace("/profile");
    } catch (error) {
      Alert.alert("Не удалось отправить", friendlyError(error instanceof Error ? error.message : undefined));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeader title="Стать сантехником" subtitle="Второй аккаунт не нужен" onBack={() => safeBack("/profile")} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {profile?.rejectionReason ? <View style={styles.rejected}><Text style={styles.rejectedTitle}>Что нужно исправить</Text><Text style={styles.rejectedText}>{profile.rejectionReason}</Text></View> : null}
          <AppInput label="Имя и фамилия" value={fullName} onChangeText={setFullName} placeholder="Ваше имя" />
          <View style={styles.phoneCard}><Ionicons name="call-outline" size={20} color={colors.secondary} /><View style={styles.flex}><Text style={styles.phoneLabel}>Телефон аккаунта</Text><Text style={styles.phone}>{user.phone}</Text></View></View>
          <AppInput label="Город" value={city} onChangeText={setCity} placeholder="Бишкек" />
          <AppInput label="Рабочие районы" value={districts} onChangeText={setDistricts} placeholder="Октябрьский, Первомайский" />
          <Text style={styles.hint}>Перечислите через запятую.</Text>
          <AppInput label="Специализации" value={specializations} onChangeText={setSpecializations} placeholder="Отопление, водоснабжение, монтаж" />
          <AppInput label="Стаж, лет" value={experience} onChangeText={setExperience} keyboardType="number-pad" placeholder="5" />
          <AppInput label="О себе (необязательно)" value={description} onChangeText={setDescription} multiline style={styles.multiline} placeholder="Опыт, типы объектов и удобное время" />
          <LegalLinks />
          <PhotoAttachment value={photoUrl} onChange={setPhotoUrl} />
          <Consent checked={programConsent} onPress={() => setProgramConsent((value) => !value)} text="Принимаю правила программы лояльности" />
          <Consent checked={dataConsent} onPress={() => setDataConsent((value) => !value)} text="Согласен на обработку данных анкеты для проверки и участия" />
          <AppButton title={profile ? "Отправить повторно" : "Отправить анкету"} onPress={() => void submit()} loading={submitApplication.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Consent({ checked, onPress, text }: { checked: boolean; onPress: () => void; text: string }) {
  return <Pressable accessibilityRole="checkbox" aria-checked={checked} accessibilityState={{ checked }} onPress={onPress} style={styles.consent}><View style={[styles.checkbox, checked && styles.checked]}>{checked ? <Ionicons name="checkmark" size={16} color={colors.surface} /> : null}</View><Text style={styles.consentText}>{text}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 48, gap: spacing.lg },
  statusBody: { flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: "center" },
  statusCard: { alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.xxl },
  statusTitle: { color: colors.text, fontSize: typography.heading, fontWeight: "900", textAlign: "center" },
  statusText: { color: colors.textMuted, fontSize: typography.body, lineHeight: 22, textAlign: "center" },
  reason: { color: colors.danger, fontSize: typography.small, fontWeight: "700", textAlign: "center" },
  rejected: { backgroundColor: colors.dangerSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  rejectedTitle: { color: colors.danger, fontSize: typography.body, fontWeight: "900" },
  rejectedText: { color: colors.text, fontSize: typography.small, lineHeight: 20 },
  phoneCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.secondarySoft, borderRadius: radius.md, padding: spacing.md },
  phoneLabel: { color: colors.textMuted, fontSize: typography.tiny },
  phone: { color: colors.secondary, fontSize: typography.body, fontWeight: "900", marginTop: 2 },
  hint: { color: colors.textSubtle, fontSize: typography.tiny, marginTop: -spacing.md },
  multiline: { minHeight: 92, textAlignVertical: "top", paddingTop: spacing.md },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, minHeight: 44 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  checked: { backgroundColor: colors.secondary },
  consentText: { flex: 1, color: colors.text, fontSize: typography.small, lineHeight: 20 }
});
