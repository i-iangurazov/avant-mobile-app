import { Platform, StyleSheet, type ViewStyle } from "react-native";

export const colors = {
  background: "#F5F6F8",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F2F5",
  primary: "#E8380D",
  primaryDark: "#B82A08",
  primarySoft: "#FFF0ED",
  text: "#171A1F",
  textMuted: "#6B7280",
  textSubtle: "#9CA3AF",
  border: "#E5E7EB",
  success: "#059669",
  successSoft: "#ECFDF5",
  warning: "#D97706",
  warningSoft: "#FFF7ED",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2"
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999
};

export const typography = {
  title: 24,
  heading: 20,
  subheading: 17,
  body: 15,
  small: 13,
  tiny: 11
};

export const shadows = StyleSheet.create({
  card: Platform.select({
    web: {
      boxShadow: "0 6px 16px rgba(0, 0, 0, 0.08)"
    } as ViewStyle,
    default: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4
    }
  }) as ViewStyle,
  tabBar: Platform.select({
    web: {
      boxShadow: "0 12px 26px rgba(0, 0, 0, 0.16)"
    } as ViewStyle,
    default: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 26,
      elevation: 12
    }
  }) as ViewStyle
});

export const isAndroid = Platform.OS === "android";
