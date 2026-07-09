import { StyleSheet, Text, TextInput, type TextInputProps, type TextStyle, View } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";

type AppInputProps = TextInputProps & {
  label: string;
  error?: string;
};

export function AppInput({ label, error, style, ...props }: AppInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        style={[styles.input, webInputReset, error && styles.inputError, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const webInputReset = { outlineStyle: "none" } as unknown as TextStyle;

const styles = StyleSheet.create({
  field: {
    width: "100%",
    alignSelf: "stretch",
    gap: spacing.sm
  },
  label: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "700"
  },
  input: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: typography.body
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft
  },
  error: {
    color: colors.danger,
    fontSize: typography.tiny,
    fontWeight: "600"
  }
});
