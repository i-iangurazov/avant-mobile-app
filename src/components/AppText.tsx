import { Text as NativeText, useWindowDimensions, type TextProps } from "react-native";

// RN 0.81 Fabric can retain old text bounds after a live system font-scale
// change (react-native#52895). Recreate only the text node so it is measured
// again; navigation, controlled inputs and form state stay mounted.
// Keep native font scaling enabled, including accessibility sizes.
export function AppText(props: TextProps) {
  const { fontScale } = useWindowDimensions();
  return <NativeText key={fontScale} {...props} />;
}
