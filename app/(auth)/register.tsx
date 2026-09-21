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
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import {
  friendlyError,
  handleKyrgyzPhoneInput,
  isValidKyrgyzPhone,
  normalizePhone,
  phoneValidationMessage
} from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";

type AccountType = "customer" | "plumber";
type FieldErrors = Partial<Record<
  "name" | "phone" | "address" | "password" | "passwordRepeat" | "districts" | "specializations" | "experience" | "consent",
  string
>>;

const toList = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>("customer");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [city, setCity] = useState("Бишкек");
  const [districts, setDistricts] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [experience, setExperience] = useState("");
  const [description, setDescription] = useState("");
  const documents=useDocuments();

  const [programConsent, setProgramConsent] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const documentVersions=documents.data?.map(doc=>`${doc.kind}:${doc.version}`).join("|");
  useEffect(()=>{setProgramConsent(false);setDataConsent(false);},[documentVersions]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const normalizedPhone = normalizePhone(phone);
    const plumber = accountType === "plumber";
    const experienceYears = Number(experience || 0);
    const nextErrors: FieldErrors = {
      name: name.trim() ? undefined : "Введите имя",
      phone: isValidKyrgyzPhone(phone) ? undefined : phoneValidationMessage,
      address: address.trim() ? undefined : "Введите адрес",
      password: password.length >= 8 ? undefined : "Минимум 8 символов",
      passwordRepeat: passwordRepeat ? undefined : "Повторите пароль",
      districts: plumber && !toList(districts).length ? "Укажите хотя бы один район" : undefined,
      specializations: plumber && !toList(specializations).length ? "Укажите хотя бы одну специализацию" : undefined,
      experience: plumber && (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80)
        ? "Укажите стаж от 0 до 80 лет"
        : undefined,
      consent: plumber && (!programConsent || !dataConsent) ? "Подтвердите оба согласия" : undefined
    };
    if (password && passwordRepeat && password !== passwordRepeat) nextErrors.passwordRepeat = "Пароли не совпадают";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    try {
      setLoading(true);
      const result = await signUp({
        name: name.trim(),
        phone: normalizedPhone,
        address: address.trim(),
        password,
        accountType,
        plumberApplication: plumber ? {
          fullName: name.trim(),
          city: city.trim() || "Бишкек",
          workingDistricts: toList(districts),
          specializations: toList(specializations),
          experienceYears,

          description: description.trim() || null,
          programDocumentVersion:documents.data?.find(d=>d.kind==="loyalty")?.version,
          privacyDocumentVersion:documents.data?.find(d=>d.kind==="privacy")?.version,
          programConsent,
          dataProcessingConsent: dataConsent
        } : undefined
      });
      if (result.needsLogin) {
        Alert.alert("Аккаунт создан", "Теперь войдите с телефоном и паролем.");
        router.replace("/login");
        return;
      }
      if (plumber) {
        Alert.alert("Заявка отправлена", "Аккаунт создан. После проверки откроются QR-код, бонусы и заявки клиентов.");
        router.replace("/profile");
      } else {
        router.replace("/catalog");
      }
    } catch (error) {
      Alert.alert("Не удалось зарегистрироваться", friendlyError(error instanceof Error ? error.message : undefined));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScreenHeader title="Создать аккаунт" subtitle="Один аккаунт для покупок и программы мастеров" onBack={() => safeBack("/welcome")} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.block}>
            <Text style={styles.label}>Тип аккаунта</Text>
            <View style={styles.accountRow}>
              {([
                ["customer", "Покупатель", "cart-outline", "Каталог, корзина и заказы"],
                ["plumber", "Сантехник", "construct-outline", "Бонусы, QR и заявки клиентов"]
              ] as const).map(([value, title, icon, subtitle]) => {
                const selected = accountType === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    aria-checked={selected} accessibilityState={{ checked: selected }}
                    accessibilityLabel={title}
                    onPress={() => setAccountType(value)}
                    style={[styles.accountCard, selected && styles.accountCardSelected]}
                  >
                    <Ionicons name={icon} size={24} color={selected ? colors.primary : colors.textMuted} />
                    <Text style={[styles.accountTitle, selected && styles.accountTitleSelected]}>{title}</Text>
                    <Text style={styles.accountSubtitle}>{subtitle}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <AppInput label="Имя и фамилия" placeholder="Как к вам обращаться" value={name} onChangeText={setName} error={errors.name} autoComplete="name" />
          <AppInput
            label="Телефон"
            placeholder="+996 700 000 000"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(value) => setPhone(handleKyrgyzPhoneInput(value))}
            error={errors.phone}
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
          <AppInput label="Адрес" placeholder="Улица, дом, квартира" value={address} onChangeText={setAddress} error={errors.address} />

          {accountType === "plumber" ? (
            <View style={styles.plumberBlock}>
              <View style={styles.sectionHeading}>
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.secondary} />
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>Анкета сантехника</Text>
                  <Text style={styles.sectionText}>Данные увидит только команда Авантехник при проверке.</Text>
                </View>
              </View>
              <AppInput label="Город" placeholder="Бишкек" value={city} onChangeText={setCity} />
              <AppInput
                label="Рабочие районы"
                placeholder="Октябрьский, Первомайский"
                value={districts}
                onChangeText={setDistricts}
                error={errors.districts}
              />
              <Text style={styles.hint}>Перечислите через запятую.</Text>
              <AppInput
                label="Специализации"
                placeholder="Отопление, водоснабжение, монтаж"
                value={specializations}
                onChangeText={setSpecializations}
                error={errors.specializations}
              />
              <AppInput
                label="Стаж, лет"
                placeholder="5"
                value={experience}
                onChangeText={setExperience}
                keyboardType="number-pad"
                error={errors.experience}
              />
              <AppInput
                label="О себе (необязательно)"
                placeholder="Опыт, типы объектов и удобное время"
                value={description}
                onChangeText={setDescription}
                multiline
                style={styles.multiline}
              />
              <Text style={styles.label}>Фото можно добавить в анкете после входа.</Text>
              <ConsentRow checked={programConsent} onPress={() => setProgramConsent((value) => !value)} text="Я принимаю правила программы лояльности для сантехников" />
              <ConsentRow checked={dataConsent} onPress={() => setDataConsent((value) => !value)} text="Я согласен на обработку данных анкеты для проверки и участия" />
              {errors.consent ? <Text style={styles.error}>{errors.consent}</Text> : null}
            </View>
          ) : null}

          <LegalLinks />
          <AppInput label="Пароль" placeholder="Минимум 8 символов" secureTextEntry value={password} onChangeText={setPassword} error={errors.password} />
          <AppInput label="Повторите пароль" placeholder="Повторите пароль" secureTextEntry value={passwordRepeat} onChangeText={setPasswordRepeat} error={errors.passwordRepeat} />
          <AppButton title={accountType === "plumber" ? "Создать аккаунт и отправить анкету" : "Создать аккаунт"} onPress={() => void submit()} loading={loading} />
          <View style={styles.inline}>
            <Text style={styles.inlineText}>Уже есть аккаунт?</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/login")}>
              <Text style={styles.link}>Войти</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConsentRow({ checked, onPress, text }: { checked: boolean; onPress: () => void; text: string }) {
  return (
    <Pressable accessibilityRole="checkbox" aria-checked={checked} accessibilityState={{ checked }} onPress={onPress} style={styles.consentRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.surface} /> : null}
      </View>
      <Text style={styles.consentText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { padding: spacing.xxl, paddingBottom: 48, gap: spacing.lg },
  block: { gap: spacing.sm },
  label: { color: colors.text, fontSize: typography.small, fontWeight: "800" },
  accountRow: { flexDirection: "row", gap: spacing.sm },
  accountCard: { flex: 1, minHeight: 126, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  accountCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  accountTitle: { color: colors.text, fontSize: typography.body, fontWeight: "900" },
  accountTitleSelected: { color: colors.primary },
  accountSubtitle: { color: colors.textMuted, fontSize: typography.tiny, lineHeight: 16 },
  plumberBlock: { borderWidth: 1, borderColor: colors.secondarySoftBorder, backgroundColor: colors.secondarySoft, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  sectionHeading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  sectionTitle: { color: colors.secondary, fontSize: typography.subheading, fontWeight: "900" },
  sectionText: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19, marginTop: 2 },
  hint: { color: colors.textSubtle, fontSize: typography.tiny, marginTop: -spacing.sm },
  multiline: { minHeight: 88, textAlignVertical: "top", paddingTop: spacing.md },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, minHeight: 44, paddingVertical: spacing.xs },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.secondary, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkboxChecked: { backgroundColor: colors.secondary },
  consentText: { flex: 1, color: colors.text, fontSize: typography.small, lineHeight: 20 },
  error: { color: colors.danger, fontSize: typography.tiny, fontWeight: "700" },
  inline: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.xs },
  inlineText: { color: colors.textMuted, fontSize: typography.small },
  link: { color: colors.primary, fontSize: typography.small, fontWeight: "900" }
});
