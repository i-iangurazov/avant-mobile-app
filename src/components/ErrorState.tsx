import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { friendlyError } from "../lib/formatters";
import { AppButton } from "./AppButton";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ title = "Ошибка загрузки", message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="alert-circle-outline" size={52} color={colors.danger} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{friendlyError(message)}</Text>
      {onRetry ? <AppButton title="Повторить" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center"
  },
  message: {
    maxWidth: "100%",
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: "center"
  }
});
