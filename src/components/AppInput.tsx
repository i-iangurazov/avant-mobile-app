import { Platform, StyleSheet, TextInput, type TextInputProps, type TextStyle, View } from "react-native";
import { AppText as Text, useSystemTextStyle } from "./AppText";
import { colors, radius, spacing, typography } from "../constants/theme";

type AppInputProps = TextInputProps & {
  label: string;
  error?: string;
  prefix?: string;
};

export function AppInput({ label, error, prefix, style, ...props }: AppInputProps) {
  const inputStyle = useSystemTextStyle([styles.input, webInputReset, error && styles.inputError, prefix && styles.prefixedInput, style], props.allowFontScaling, props.maxFontSizeMultiplier);
  const input = <TextInput
    accessibilityLabel={props.accessibilityLabel || label}
    placeholderTextColor={colors.textSubtle}
    selectionColor={colors.primary}
    style={inputStyle}
    {...props}
    allowFontScaling={Platform.OS === "android" ? false : props.allowFontScaling}
  />;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {prefix ? <View style={[styles.prefixRow, error && styles.inputError]}>
        <Text accessible={false} style={styles.prefix}>{prefix}</Text>
        {input}
      </View> : input}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const webInputReset = { outlineStyle: "none" } as unknown as TextStyle;

const styles = StyleSheet.create({
  prefixRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceMuted, paddingLeft: spacing.lg
  },
  prefix: { color: colors.text, fontSize: typography.body, fontWeight: "600" },
  prefixedInput: { flex: 1, width: undefined, minWidth: 0, borderWidth: 0, backgroundColor: "transparent", paddingLeft: 0 },
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
