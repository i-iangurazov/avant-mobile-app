import Ionicons from "@expo/vector-icons/Ionicons";
import * as Brightness from "expo-brightness";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../src/components/AppText";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, shadows, spacing, typography } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";
import { usePlumberQr } from "../../src/hooks/useProgram";
import { safeBack } from "../../src/lib/navigation/safeBack";

export default function PlumberQrScreen() {
  const { user } = useAuth();
  const qr = usePlumberQr();
  const previousBrightness = useRef<number | null>(null);
  const [bright, setBright] = useState(false);
  const [changingBrightness, setChangingBrightness] = useState(false);

  useEffect(() => () => {
    if (previousBrightness.current !== null && Platform.OS !== "web") {
      void Brightness.setBrightnessAsync(previousBrightness.current).catch(() => undefined);
    }
  }, []);

  const toggleBrightness = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Яркость", "На сайте измените яркость в настройках устройства.");
      return;
    }
    setChangingBrightness(true);
    try {
      if (!bright) {
        previousBrightness.current = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
        setBright(true);
      } else {
        await Brightness.setBrightnessAsync(previousBrightness.current ?? 0.6);
        previousBrightness.current = null;
        setBright(false);
      }
    } catch {
      Alert.alert("Не удалось изменить яркость", "Увеличьте яркость вручную в настройках телефона.");
    } finally {
      setChangingBrightness(false);
    }
  };

  if (!user) return <SafeAreaView style={styles.safe}><EmptyState title="Войдите в аккаунт" actionTitle="Войти" onAction={() => router.replace("/login")} /></SafeAreaView>;
  if (user.plumber?.applicationStatus !== "approved") {
    return <SafeAreaView style={styles.safe}><ScreenHeader title="Мой QR" onBack={() => safeBack("/profile")} /><EmptyState title="QR пока недоступен" text="Код появится после подтверждения анкеты сантехника." icon="qr-code-outline" actionTitle="Открыть анкету" onAction={() => router.push("/plumber/apply")} /></SafeAreaView>;
  }
  if (qr.isLoading) return <SafeAreaView style={styles.safe}><LoadingState text="Готовим персональный QR-код..." /></SafeAreaView>;
  if (qr.isError || !qr.data) return <SafeAreaView style={styles.safe}><ErrorState message={qr.error?.message} onRetry={() => void qr.refetch()} /></SafeAreaView>;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <ScreenHeader title="Мой QR" subtitle="Для начисления бонусов на кассе" onBack={() => safeBack("/plumber-home")} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.level}><Ionicons name="ribbon" size={16} color={colors.secondary} /><Text style={styles.levelText}>{qr.data.level.name}</Text></View>
          <Text style={styles.name}>{qr.data.plumberName}</Text>
          <View accessible accessibilityLabel={`QR-код сантехника ${qr.data.plumberName}`} style={styles.qrWrap}>
            <QRCode value={qr.data.qrPayload} size={238} backgroundColor="#FFFFFF" color="#0B1F33" quietZone={8} ecl="H" />
          </View>
          <Text style={styles.codeLabel}>КОД УЧАСТНИКА</Text>
          <Text selectable style={styles.code}>{qr.data.loyaltyCode}</Text>
          <View style={styles.instructions}>
            <Ionicons name="information-circle-outline" size={22} color={colors.secondary} />
            <Text style={styles.instructionsText}>Покажите QR кассиру до закрытия чека. Покупку можно привязать к вам, даже если платит ваш клиент.</Text>
          </View>
        </View>

        <AppButton
          title={bright ? "Вернуть обычную яркость" : "Максимальная яркость"}
          variant={bright ? "secondary" : "primary"}
          loading={changingBrightness}
          icon={<Ionicons name={bright ? "sunny" : "sunny-outline"} size={20} color={bright ? colors.primary : colors.surface} />}
          onPress={() => void toggleBrightness()}
        />
        <Text style={styles.security}>В QR нет номера аккаунта, телефона или других личных данных. Код можно безопасно показать кассиру.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  card: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, ...shadows.card },
  level: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.secondarySoft, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill },
  levelText: { color: colors.secondary, fontSize: typography.small, fontWeight: "900" },
  name: { color: colors.text, fontSize: typography.heading, fontWeight: "900", marginTop: spacing.md, textAlign: "center" },
  qrWrap: { marginVertical: spacing.xl, padding: spacing.md, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  codeLabel: { color: colors.textSubtle, fontSize: typography.tiny, fontWeight: "900", letterSpacing: 1.4 },
  code: { color: colors.secondary, fontSize: 24, fontWeight: "900", letterSpacing: 2, marginTop: spacing.xs },
  instructions: { marginTop: spacing.xl, flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.secondarySoft, padding: spacing.md },
  instructionsText: { flex: 1, color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  security: { color: colors.textSubtle, fontSize: typography.tiny, lineHeight: 16, textAlign: "center", paddingHorizontal: spacing.lg }
});
