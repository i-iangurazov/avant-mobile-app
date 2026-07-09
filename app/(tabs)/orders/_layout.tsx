import { Stack } from "expo-router";
import { colors } from "../../../src/constants/theme";

export default function OrdersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
