import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, shadows, spacing, typography } from "../../src/constants/theme";
import { safeBack } from "../../src/lib/navigation/safeBack";
import { openWhatsApp } from "../../src/lib/whatsapp";

export default function AboutScreen() {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScreenHeader title="О приложении" onBack={() => safeBack("/profile")} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons name="construct-outline" size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>Авантехник</Text>
          <Text style={styles.text}>
            Мобильное приложение для покупки сантехники, отопления, водоснабжения, труб, фитингов,
            фильтров и товаров для ремонта в Бишкеке.
          </Text>
        </View>

        <View style={styles.card}>
          <InfoRow label="Город" value="Бишкек, Кыргызстан" />
          <InfoRow label="Каталог" value="Все товары" />
          <InfoRow label="Заказы" value="Менеджер подтверждает наличие и цену" />
          <InfoRow label="Версия" value="1.0.0" />
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Написать в WhatsApp"
            onPress={() => void openWhatsApp("Здравствуйте! Мне нужна помощь с приложением Авантехник.")}
          />
          <AppButton
            title="Открыть 2GIS"
            variant="secondary"
            onPress={() => void Linking.openURL("https://2gis.kg/bishkek/search/%D0%90%D0%B2%D0%B0%D0%BD%D1%82%D0%B5%D1%85%D0%BD%D0%B8%D0%BA")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 118
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    alignItems: "center",
    gap: spacing.md,
    ...shadows.card
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900"
  },
  text: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: "center"
  },
  card: {
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadows.card
  },
  row: {
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "700"
  },
  rowValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    textAlign: "right"
  },
  actions: {
    gap: spacing.md
  }
});
