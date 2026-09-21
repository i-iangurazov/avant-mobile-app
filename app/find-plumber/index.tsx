import {PhotoAttachment} from "../../src/components/PhotoAttachment";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
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
import { colors, radius, shadows, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { useCancelServiceRequest, useCreateServiceRequest, useCustomerServiceRequests, useReviewServiceRequest } from "../../src/hooks/useProgram";
import { isValidKyrgyzPhone, normalizePhone, phoneValidationMessage } from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";
import { leadStatusLabels } from "../../src/lib/programFormat";
import type { ServiceRequest } from "../../src/types";

const services = ["Монтаж сантехники", "Отопление", "Водоснабжение", "Канализация", "Ремонт", "Консультация"];

export default function FindPlumberScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ productId?: string }>();
  const requests = useCustomerServiceRequests();
  const create = useCreateServiceRequest();
  const cancel = useCancelServiceRequest();
  const review = useReviewServiceRequest();
  const [showForm, setShowForm] = useState(Boolean(params.productId));
  const [serviceType, setServiceType] = useState("Монтаж сантехники");
  const [description, setDescription] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<ServiceRequest | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => { if (user?.phone) setPhone((current) => current || user.phone); }, [user?.phone]);

  const submit = async () => {
    const next = {
      description: description.trim().length < 10 ? "Опишите задачу минимум в 10 символах" : "",
      district: district.trim() ? "" : "Укажите район",
      phone: !isValidKyrgyzPhone(phone) ? phoneValidationMessage : "",
      consent: !consent ? "Подтвердите согласие на передачу заявки" : "",
      photoUrl: photoUrl && !/^https:\/\//i.test(photoUrl) ? "Нужна безопасная HTTPS-ссылка" : ""
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    try {
      await create.mutateAsync({
        serviceType, description: description.trim(), district: district.trim(), address: address.trim() || null,
        preferredAt: preferredAt.trim() || null, phone: normalizePhone(phone),
        photoUrls: photoUrl.trim() ? [photoUrl.trim()] : [],
        relatedProductIds: params.productId ? [params.productId] : [], consentToShare: true
      });
      setDescription(""); setDistrict(""); setAddress(""); setPreferredAt(""); setPhotoUrl(""); setConsent(false); setShowForm(false);
      Alert.alert("Заявка отправлена", "Администратор подберёт проверенного сантехника. Контакты не рассылаются всем мастерам.");
    } catch (error) { Alert.alert("Не удалось отправить", error instanceof Error ? error.message : "Попробуйте ещё раз."); }
  };

  const submitReview = async () => {
    if (!reviewing) return;
    try { await review.mutateAsync({ id: reviewing.id, rating, review: reviewText.trim() || undefined, tags: [] }); setReviewing(null); setReviewText(""); Alert.alert("Спасибо", "Отзыв отправлен на публикацию."); }
    catch (error) { Alert.alert("Отзыв не отправлен", error instanceof Error ? error.message : "Попробуйте ещё раз."); }
  };

  if (!user) return <SafeAreaView style={styles.safe}><ScreenHeader title="Найти сантехника" onBack={() => safeBack("/catalog")} /><EmptyState title="Сначала войдите" text="Так заявка будет защищена и останется в истории." actionTitle="Войти" onAction={() => router.push("/login")} /></SafeAreaView>;
  if (requests.isLoading) return <SafeAreaView style={styles.safe}><LoadingState text="Загружаем заявки..." /></SafeAreaView>;
  if (requests.isError) return <SafeAreaView style={styles.safe}><ErrorState message={requests.error.message} onRetry={() => void requests.refetch()} /></SafeAreaView>;

  return <SafeAreaView edges={["top", "bottom"]} style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><ScreenHeader title="Найти сантехника" subtitle="Только проверенные мастера" onBack={() => safeBack("/catalog")} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="shield-checkmark" size={28} color={colors.surface} /></View><View style={styles.heroCopy}><Text style={styles.heroTitle}>Безопасный подбор</Text><Text style={styles.heroText}>Сначала заявку видит администратор. Телефон и точный адрес откроются только назначенному мастеру после принятия.</Text></View></View>
      <AppButton title={showForm ? "Скрыть форму" : "Создать заявку"} variant={showForm ? "secondary" : "primary"} onPress={() => setShowForm((value) => !value)} />
      {showForm ? <View style={styles.form}><Text style={styles.sectionTitle}>Новая заявка</Text><Text style={styles.label}>Вид работ</Text><View style={styles.chips}>{services.map((item) => <Pressable accessibilityRole="radio" aria-checked={serviceType===item} accessibilityState={{ checked: serviceType === item }} key={item} onPress={() => setServiceType(item)} style={[styles.chip, serviceType === item && styles.chipActive]}><Text style={[styles.chipText, serviceType === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
        <AppInput label="Что нужно сделать" placeholder="Например: установить смеситель и подключить мойку" value={description} onChangeText={setDescription} multiline style={styles.multiline} error={errors.description} />
        <AppInput label="Район" placeholder="Например: 7 микрорайон" value={district} onChangeText={setDistrict} error={errors.district} />
        <AppInput label="Точный адрес (необязательно)" placeholder="Откроется только принятому мастеру" value={address} onChangeText={setAddress} />
        <AppInput label="Желаемые дата и время (необязательно)" placeholder="2026-09-10T14:00:00+06:00" value={preferredAt} onChangeText={setPreferredAt} autoCapitalize="none" />
        <AppInput label="Телефон" keyboardType="phone-pad" value={phone} onChangeText={setPhone} error={errors.phone} />
        <PhotoAttachment value={photoUrl} onChange={setPhotoUrl} />
        {params.productId ? <Text style={styles.related}>Заявка связана с товаром из каталога.</Text> : null}
        <Pressable accessibilityRole="checkbox" aria-checked={consent} accessibilityState={{ checked: consent }} onPress={() => setConsent((value) => !value)} style={styles.consent}><Ionicons name={consent ? "checkbox" : "square-outline"} size={23} color={consent ? colors.secondary : colors.textSubtle} /><Text style={styles.consentText}>Согласен передать описание, район и после принятия — контакт назначенному сантехнику.</Text></Pressable>{errors.consent ? <Text style={styles.error}>{errors.consent}</Text> : null}
        <AppButton title="Отправить заявку" loading={create.isPending} onPress={() => void submit()} />
      </View> : null}

      <Text style={styles.sectionTitle}>Мои заявки</Text>
      {!requests.data?.length ? <View style={styles.emptyInline}><Ionicons name="documents-outline" size={28} color={colors.textSubtle} /><Text style={styles.emptyText}>Заявок пока нет</Text></View> : requests.data.map((item) => <View key={item.id} style={styles.requestCard}><View style={styles.requestTop}><Text style={styles.requestTitle}>{item.serviceType}</Text><Text style={styles.status}>{leadStatusLabels[item.status]}</Text></View><Text style={styles.requestText}>{item.district} · {new Date(item.createdAt).toLocaleDateString("ru-RU")}</Text><Text numberOfLines={3} style={styles.requestDescription}>{item.description}</Text>{item.assignedPlumber ? <Text style={styles.master}>Мастер: {item.assignedPlumber.name ?? "Назначен"}</Text> : null}{["new", "viewed"].includes(item.status) ? <AppButton title="Отменить заявку" variant="ghost" loading={cancel.isPending && cancel.variables === item.id} onPress={() => Alert.alert("Отменить заявку?", "Подбор мастера будет остановлен.", [{ text: "Нет", style: "cancel" }, { text: "Отменить", style: "destructive", onPress: () => void cancel.mutateAsync(item.id).catch((error) => Alert.alert("Не удалось отменить", error instanceof Error ? error.message : "Попробуйте ещё раз.")) }])} /> : null}{item.status === "completed" ? <AppButton title="Оставить отзыв" variant="secondary" onPress={() => setReviewing(item)} /> : null}</View>)}
      {reviewing ? <View style={styles.form}><Text style={styles.sectionTitle}>Оцените работу</Text><View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable accessibilityRole="radio" aria-checked={value===rating} accessibilityState={{checked:value===rating}} accessibilityLabel={`${value} из 5`} key={value} onPress={() => setRating(value)}><Ionicons name={value <= rating ? "star" : "star-outline"} size={34} color={colors.warning} /></Pressable>)}</View><AppInput label="Комментарий (необязательно)" value={reviewText} onChangeText={setReviewText} multiline style={styles.multiline} /><AppButton title="Отправить отзыв" loading={review.isPending} onPress={() => void submitReview()} /><AppButton title="Отмена" variant="ghost" onPress={() => setReviewing(null)} /></View> : null}
    </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }, hero: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.secondary, borderRadius: radius.xl, padding: spacing.lg }, heroIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,.16)", alignItems: "center", justifyContent: "center" }, heroCopy: { flex: 1 }, heroTitle: { color: colors.surface, fontSize: typography.subheading, fontWeight: "900" }, heroText: { color: "#D8EBFF", fontSize: typography.small, lineHeight: 19, marginTop: 4 }, form: { gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.card }, sectionTitle: { color: colors.text, fontSize: typography.heading, fontWeight: "900" }, label: { color: colors.text, fontSize: typography.small, fontWeight: "800" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, chip: { backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: colors.secondarySoft, borderColor: colors.secondary }, chipText: { color: colors.textMuted, fontSize: typography.small, fontWeight: "700" }, chipTextActive: { color: colors.secondary }, multiline: { minHeight: 88, textAlignVertical: "top", paddingTop: spacing.md }, related: { color: colors.secondary, fontSize: typography.small, fontWeight: "800" }, consent: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, consentText: { flex: 1, color: colors.textMuted, fontSize: typography.small, lineHeight: 19 }, error: { color: colors.danger, fontSize: typography.tiny, fontWeight: "700" }, emptyInline: { alignItems: "center", padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface }, emptyText: { color: colors.textSubtle, fontSize: typography.small, marginTop: spacing.sm }, requestCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...shadows.card }, requestTop: { flexDirection: "row", gap: spacing.sm, alignItems: "center" }, requestTitle: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: "900" }, status: { color: colors.secondary, fontSize: typography.tiny, fontWeight: "900", backgroundColor: colors.secondarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 }, requestText: { color: colors.textSubtle, fontSize: typography.tiny }, requestDescription: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 }, master: { color: colors.success, fontSize: typography.small, fontWeight: "800" }, stars: { flexDirection: "row", justifyContent: "center", gap: spacing.sm } });
