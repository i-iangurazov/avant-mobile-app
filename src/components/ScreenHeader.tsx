import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  titleWrap: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textSubtle,
    fontSize: typography.small,
    marginTop: 2
  },
  placeholder: {
    width: 38
  }
});
