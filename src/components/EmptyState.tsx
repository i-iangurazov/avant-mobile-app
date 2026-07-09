import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { AppButton } from "./AppButton";

type EmptyStateProps = {
  title: string;
  text?: string;
  icon?: string;
  actionTitle?: string;
  onAction?: () => void;
};

export function EmptyState({ title, text, icon = "file-tray-outline", actionTitle, onAction }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon as never} size={54} color={colors.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {actionTitle && onAction ? <AppButton title={actionTitle} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.lg
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center"
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: "center",
    lineHeight: 22
  }
});
