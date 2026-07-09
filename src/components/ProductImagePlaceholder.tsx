import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "../constants/theme";

type ProductImagePlaceholderProps = {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ProductImagePlaceholder({ compact = false, style }: ProductImagePlaceholderProps) {
  return (
    <View style={[styles.placeholder, compact && styles.compact, style]}>
      <View style={[styles.iconWrap, compact && styles.compactIconWrap]}>
        <Ionicons name="image-outline" size={compact ? 18 : 34} color={colors.textSubtle} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted
  },
  compact: {
    backgroundColor: colors.surfaceMuted
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  compactIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md
  }
});
