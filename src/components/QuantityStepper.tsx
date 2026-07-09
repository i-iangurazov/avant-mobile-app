import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import type { TextStyle } from "react-native";
import { colors, radius, spacing, typography } from "../constants/theme";

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
};

const clampQuantity = (value: number, min: number, max?: number) => {
  const limited = Math.max(min, Math.floor(value));
  return max ? Math.min(limited, max) : limited;
};

const webInputReset = {
  outlineStyle: "none",
  outlineWidth: 0,
  boxShadow: "none"
} as unknown as TextStyle;

export function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
  onChange,
  min = 1,
  max
}: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));
  const canDecrease = value > min;

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    const next = Number(draft.replace(/\D/g, ""));
    const normalized = Number.isFinite(next) && next > 0 ? clampQuantity(next, min, max) : min;
    setDraft(String(normalized));
    onChange?.(normalized);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Уменьшить количество"
        disabled={!canDecrease}
        hitSlop={8}
        onPress={canDecrease ? onDecrease : undefined}
        style={({ pressed }) => [
          styles.control,
          !canDecrease && styles.controlDisabled,
          pressed && canDecrease && styles.controlPressed
        ]}
      >
        <Ionicons name="remove" size={19} color={canDecrease ? colors.text : colors.textSubtle} />
      </Pressable>
      <TextInput
        accessibilityLabel="Количество"
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        value={draft}
        onBlur={commitDraft}
        onSubmitEditing={commitDraft}
        onChangeText={(text) => setDraft(text.replace(/\D/g, "").slice(0, 4))}
        style={[styles.valueInput, Platform.OS === "web" ? webInputReset : null]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Увеличить количество"
        hitSlop={8}
        onPress={onIncrease}
        style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
      >
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 174,
    height: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface
  },
  control: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  controlPressed: {
    backgroundColor: colors.surfaceMuted
  },
  controlDisabled: {
    opacity: 0.45
  },
  valueInput: {
    flexGrow: 0,
    flexShrink: 0,
    width: 78,
    minWidth: 0,
    height: 44,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    paddingHorizontal: spacing.xs,
    paddingVertical: 0
  }
});
