import { router } from "expo-router";
import { useCallback, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../src/components/AppButton";
import { assets } from "../src/constants/assets";
import { colors, spacing, typography } from "../src/constants/theme";
import { useAuth } from "../src/hooks/useAuth";

export default function SplashScreen() {
  const { session, isLoading } = useAuth();
  const didNavigate = useRef(false);

  const goNext = useCallback(() => {
    if (didNavigate.current || isLoading) {
      return;
    }
    didNavigate.current = true;
    router.replace(session ? "/catalog" : "/welcome");
  }, [isLoading, session]);

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.container} onPress={goNext}>
        <View style={styles.center}>
          <Image source={assets.icon} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Авантехник</Text>
          <Text style={styles.tagline}>Сантехника, отопление и товары для ремонта</Text>
        </View>
        <View style={styles.action}>
          <AppButton title={isLoading ? "Загрузка..." : "Начать"} onPress={goNext} loading={isLoading} />
        </View>
      </Pressable>
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
    justifyContent: "space-between"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg
  },
  logo: {
    width: 112,
    height: 112
  },
  appName: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900"
  },
  tagline: {
    maxWidth: 280,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  action: {
    paddingBottom: spacing.xxl
  }
});
