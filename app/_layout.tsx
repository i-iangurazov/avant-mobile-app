import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/constants/theme";
import { AppProviders } from "../src/providers/AppProviders";

export default function RootLayout() {
  return (
    <AppProviders>
      <View style={styles.root}>
        <SafeAreaProvider style={[styles.safeArea, Platform.OS === "web" && styles.webFrame]}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="category/[id]" />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="checkout/index" />
            <Stack.Screen name="orders/[id]" />
            <Stack.Screen name="profile/edit" />
            <Stack.Screen name="profile/about" />
            <Stack.Screen name="image-search/index" />
          </Stack>
        </SafeAreaProvider>
      </View>
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#E9EDF2" : colors.background,
    alignItems: Platform.OS === "web" ? "center" : "stretch"
  },
  safeArea: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.background
  },
  webFrame: Platform.select({
    web: {
      maxWidth: 430,
      overflow: "hidden"
    } as ViewStyle,
    default: {}
  }) as ViewStyle
});
