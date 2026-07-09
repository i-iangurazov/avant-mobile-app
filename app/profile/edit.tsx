import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { AppInput } from "../../src/components/AppInput";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, spacing } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { useProfile, useUpdateProfile } from "../../src/hooks/useProfile";
import {
  friendlyError,
  handleKyrgyzPhoneInput,
  isValidKyrgyzPhone,
  normalizePhone,
  phoneValidationMessage
} from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";

export default function EditProfileScreen() {
  const { user } = useAuth();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name);
      setPhone(handleKyrgyzPhoneInput(profile.data.phone));
      setAddress(profile.data.address ?? "");
    }
  }, [profile.data]);

  const save = async () => {
    if (!isValidKyrgyzPhone(phone)) {
      Alert.alert("Проверьте телефон", phoneValidationMessage);
      return;
    }

    try {
      await updateProfile.mutateAsync({
        name: name.trim() || "Покупатель",
        phone: normalizePhone(phone),
        address: address.trim()
      });
      safeBack("/profile");
    } catch (error) {
      Alert.alert("Не удалось сохранить профиль", friendlyError(error instanceof Error ? error.message : undefined));
    }
  };

  if (!user) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScreenHeader title="Редактировать профиль" onBack={() => safeBack("/profile")} />
        <EmptyState
          title="Войдите в аккаунт"
          text="Редактирование профиля доступно после входа в аккаунт."
          icon="person-circle-outline"
          actionTitle="Войти"
          onAction={() => router.replace("/login")}
        />
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

  if (profile.isError) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ErrorState message={profile.error.message} onRetry={() => void profile.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScreenHeader title="Редактировать профиль" onBack={() => safeBack("/profile")} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppInput label="Имя" placeholder="Ваше имя" value={name} onChangeText={setName} />
          <AppInput
            label="Телефон"
            placeholder="+996 700 000 000"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(value) => setPhone(handleKyrgyzPhoneInput(value))}
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
          <AppInput label="Адрес" placeholder="Улица, дом, квартира" value={address} onChangeText={setAddress} />
          <AppButton title="Сохранить" onPress={() => void save()} loading={updateProfile.isPending} />
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
  }
});
