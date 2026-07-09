import { Tabs } from "expo-router";
import { BottomTabBar } from "../../src/components/BottomTabBar";
import { LoadingState } from "../../src/components/LoadingState";
import { colors } from "../../src/constants/theme";
import { useAuth } from "../../src/hooks/useAuth";

export default function TabsLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState text="Проверяем вход..." />;
  }

  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background }
      }}
    >
      <Tabs.Screen name="catalog" options={{ title: "Каталог" }} />
      <Tabs.Screen name="cart" options={{ title: "Корзина" }} />
      <Tabs.Screen name="maps" options={{ title: "Карты" }} />
      <Tabs.Screen name="orders" options={{ title: "Заказы" }} />
      <Tabs.Screen name="profile" options={{ title: "Профиль" }} />
    </Tabs>
  );
}
