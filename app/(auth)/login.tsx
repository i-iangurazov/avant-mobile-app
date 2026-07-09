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
import { openWhatsApp } from "../../src/lib/whatsapp";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const normalizedPhone = normalizePhone(phone);
    const nextErrors = {
      phone: isValidKyrgyzPhone(phone) ? undefined : phoneValidationMessage,
      password: password.trim() ? undefined : "Введите пароль"
    };
    setErrors(nextErrors);

    if (nextErrors.phone || nextErrors.password) {
      return;
    }

    try {
      setLoading(true);
      await signIn(normalizedPhone, password);
      router.replace("/catalog");
    } catch (error) {
      Alert.alert("Не удалось войти", friendlyError(error instanceof Error ? error.message : undefined));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScreenHeader title="Вход в аккаунт" subtitle="Введите телефон и пароль" onBack={() => safeBack("/welcome")} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          <AppInput
            label="Пароль"
            placeholder="Ваш пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />
          <Pressable
            accessibilityRole="button"
            style={styles.forgot}
            onPress={() => void openWhatsApp("Здравствуйте! Помогите восстановить доступ к аккаунту Авантехник.")}
          >
            <Text style={styles.forgotText}>Забыли пароль?</Text>
          </Pressable>
          <AppButton title="Войти" onPress={() => void submit()} loading={loading} />
          <View style={styles.inline}>
            <Text style={styles.inlineText}>Нет аккаунта?</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/register")}>
              <Text style={styles.link}>Зарегистрироваться</Text>
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
  forgot: {
    alignSelf: "flex-start"
  },
  forgotText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "800"
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
