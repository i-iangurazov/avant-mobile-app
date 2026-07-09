import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";
import { whatsAppBusinessPhone } from "../lib/config/env";
import { openWhatsApp } from "../lib/whatsapp";
import type { StoreLocation } from "../types";

type StoreCardProps = {
  store: StoreLocation;
};

export function StoreCard({ store }: StoreCardProps) {
  const phone = store.phone || whatsAppBusinessPhone;

  const openRoute = () => {
    const query = encodeURIComponent(`Авантехник ${store.address}`);
    void Linking.openURL(store.external_2gis_url ?? `https://2gis.kg/bishkek/search/${query}`);
  };

  const call = () => {
    if (phone) {
      void Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
    }
  };

  const messageWhatsApp = () => {
    void openWhatsApp(`Здравствуйте! Хочу уточнить информацию по магазину: ${store.address}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.pin}>
          <Ionicons name="location" size={18} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{store.name}</Text>
          <Text style={styles.address}>{store.address}</Text>
          <Text style={styles.hours}>{store.working_hours ?? "9:00 - 18:00"}</Text>
          <Text style={styles.phone}>{phone}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={openRoute} style={styles.actionButton}>
          <Ionicons name="navigate-outline" size={16} color={colors.primary} />
          <Text style={styles.actionText}>Открыть в 2GIS</Text>
        </Pressable>
        {phone ? (
          <Pressable accessibilityRole="button" onPress={call} style={styles.actionButton}>
            <Ionicons name="call-outline" size={16} color={colors.primary} />
            <Text style={styles.actionText}>Позвонить</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={messageWhatsApp} style={styles.actionButton}>
          <Ionicons name="logo-whatsapp" size={16} color={colors.primary} />
          <Text style={styles.actionText}>Написать в WhatsApp</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card
  },
  header: {
    flexDirection: "row",
    gap: spacing.md
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  info: {
    flex: 1,
    gap: 3
  },
  name: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900"
  },
  address: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "600"
  },
  hours: {
    color: colors.textSubtle,
    fontSize: typography.small
  },
  phone: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "700"
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: "48%",
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  actionText: {
    color: colors.primary,
    fontSize: typography.tiny,
    fontWeight: "800",
    textAlign: "center"
  }
});
