import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { AppInput } from "../../src/components/AppInput";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import {
  friendlyError,
  handleKyrgyzPhoneInput,
  isValidKyrgyzPhone,
  normalizePhone,
  phoneValidationMessage
} from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";

type FieldErrors = Partial<Record<"name" | "phone" | "address" | "password" | "passwordRepeat", string>>;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const normalizedPhone = normalizePhone(phone);
    const nextErrors: FieldErrors = {
      name: name.trim() ? undefined : "Введите имя",
      phone: isValidKyrgyzPhone(phone) ? undefined : phoneValidationMessage,
      address: address.trim() ? undefined : "Введите адрес",
      password: password.trim() ? undefined : "Введите пароль",
      passwordRepeat: passwordRepeat.trim() ? undefined : "Повторите пароль"
    };

    if (password && passwordRepeat && password !== passwordRepeat) {
      nextErrors.passwordRepeat = "Пароли не совпадают";
    }

    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    try {
      setLoading(true);
      const result = await signUp({
        name: name.trim(),
        phone: normalizedPhone,
        address: address.trim(),
        password
      });

      if (result.needsLogin) {
        Alert.alert("Аккаунт создан", "Теперь войдите с телефоном и паролем.");
        router.replace("/login");
        return;
      }

      router.replace("/catalog");
    } catch (error) {
      Alert.alert("Не удалось зарегистрироваться", friendlyError(error instanceof Error ? error.message : undefined));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScreenHeader title="Создать аккаунт" subtitle="Введите данные для регистрации" onBack={() => safeBack("/welcome")} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppInput label="Имя" placeholder="Ваше имя" value={name} onChangeText={setName} error={errors.name} />
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
          <AppInput label="Пароль" placeholder="Минимум 8 символов" secureTextEntry value={password} onChangeText={setPassword} error={errors.password} />
          <AppInput label="Повторите пароль" placeholder="Повторите пароль" secureTextEntry value={passwordRepeat} onChangeText={setPasswordRepeat} error={errors.passwordRepeat} />
          <AppButton title="Создать аккаунт" onPress={() => void submit()} loading={loading} />
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface
  },
  flex: {
    flex: 1
  },
  content: {
    padding: spacing.xxl,
    gap: spacing.lg
  },
  inline: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs
  },
  inlineText: {
    color: colors.textMuted,
    fontSize: typography.small
  },
  link: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900"
  }
});
