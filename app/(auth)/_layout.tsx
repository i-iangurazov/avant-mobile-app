import { Redirect, Stack, useGlobalSearchParams, usePathname, type Href } from "expo-router";
import { colors } from "../../src/constants/theme";
import { LoadingState } from "../../src/components/LoadingState";
import { useAuth } from "../../src/hooks/useAuth";
import { authDestination } from "../../src/lib/navigation/authDestination";

export default function AuthLayout() {
  const { session, isLoading, user } = useAuth();
  const { returnTo } = useGlobalSearchParams();
  const pathname = usePathname();

  if (isLoading) {
    return <LoadingState text="Проверяем вход..." />;
  }

  if (session) {
    const destination = returnTo ?? (pathname === "/register" && user?.plumber ? "/profile" : undefined);
    return <Redirect href={authDestination(destination, user?.plumber?.applicationStatus === "approved") as Href} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
