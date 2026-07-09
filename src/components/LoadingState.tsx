import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

type LoadingStateProps = {
  text?: string;
};

export function LoadingState({ text = "Загрузка..." }: LoadingStateProps) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.md
  },
  text: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700"
  }
});
