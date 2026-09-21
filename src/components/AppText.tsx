import { Platform, StyleSheet, Text as NativeText, useWindowDimensions, type TextProps } from "react-native";

// RN 0.81 Fabric can retain old text bounds after a live system font-scale
// change (react-native#52895). On Android, express the current system scale
// in the layout style itself so Fabric measures the same size it draws.
// Disable the second native multiplication, not accessibility scaling.
// iOS/web retain native scaling; navigation and form state stay mounted.
export function AppText(props: TextProps) {
  const style = useSystemTextStyle(props.style, props.allowFontScaling, props.maxFontSizeMultiplier);
  return <NativeText {...props} style={style} allowFontScaling={Platform.OS === "android" ? false : props.allowFontScaling} />;
}

export function useSystemTextStyle(style: TextProps["style"], allowFontScaling = true, maxFontSizeMultiplier?: number | null) {
  const { fontScale } = useWindowDimensions();
  if (Platform.OS !== "android" || !allowFontScaling) return style;
  const base = StyleSheet.flatten(style) || {};
  const scale = maxFontSizeMultiplier && maxFontSizeMultiplier >= 1 ? Math.min(fontScale, maxFontSizeMultiplier) : fontScale;
  return [style, {
    fontSize: (base.fontSize ?? 14) * scale,
    ...(base.lineHeight === undefined ? {} : { lineHeight: base.lineHeight * scale }),
    ...(base.letterSpacing === undefined ? {} : { letterSpacing: base.letterSpacing * scale })
  }];
}
