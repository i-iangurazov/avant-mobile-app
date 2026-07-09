import { Redirect, Stack } from "expo-router";
import { colors } from "../../src/constants/theme";
import { LoadingState } from "../../src/components/LoadingState";
import { useAuth } from "../../src/hooks/useAuth";

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState text="Проверяем вход..." />;
  }

  if (session) {
    return <Redirect href="/catalog" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
