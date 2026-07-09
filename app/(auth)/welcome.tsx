import { router } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { assets } from "../../src/constants/assets";
import { colors, spacing, typography } from "../../src/constants/theme";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Image source={assets.icon} style={styles.icon} resizeMode="contain" />
          <Text style={styles.title}>Добро пожаловать</Text>
          <Text style={styles.subtitle}>
            Покупайте сантехнику, отопление, трубы, фитинги и товары для ремонта в Авантехник
          </Text>
        </View>
        <View style={styles.actions}>
          <AppButton title="Войти" onPress={() => router.push("/login")} />
          <AppButton title="Зарегистрироваться" variant="secondary" onPress={() => router.push("/register")} />
          <AppButton title="Смотреть каталог" variant="ghost" onPress={() => router.replace("/catalog")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg
  },
  icon: {
    width: 86,
    height: 86
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
    textAlign: "center"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: "center"
  },
  actions: {
    gap: spacing.md
  }
});
