import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";
import { useAuth } from "../hooks/useAuth";

type RouteName = "plumber-home" | "catalog" | "cart" | "maps" | "orders" | "leads" | "profile";

const tabMeta: Record<RouteName, { label: string; icon: string }> = {
  "plumber-home": { label: "Главная", icon: "briefcase-outline" },
  catalog: { label: "Каталог", icon: "grid-outline" },
  cart: { label: "Корзина", icon: "cart-outline" },
  maps: { label: "Карты", icon: "location-outline" },
  orders: { label: "Заказы", icon: "receipt-outline" },
  leads: { label: "Заявки", icon: "people-outline" },
  profile: { label: "Профиль", icon: "person-outline" }
};

type BottomTabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  descriptors: Record<string, { options?: { tabBarAccessibilityLabel?: string; tabBarButtonTestID?: string } }>;
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isApprovedPlumber = user?.plumber?.applicationStatus === "approved";
  const visibleRoutes: RouteName[] = isApprovedPlumber
    ? ["plumber-home", "catalog", "orders", "leads", "profile"]
    : ["catalog", "cart", "maps", "orders", "profile"];
  const routes = visibleRoutes
    .map((name) => state.routes.find((route) => route.name === name))
    .filter((route): route is { key: string; name: string } => Boolean(route));

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        {routes.map((route) => {
          const routeName = route.name as RouteName;
          const meta = tabMeta[routeName];
          if (!meta) {
            return null;
          }

          const focused = state.routes[state.index]?.name === route.name;
          const options = descriptors[route.key]?.options ?? {};

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              aria-selected={focused} accessibilityState={{selected:focused}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                focused && styles.tabActive,
                pressed && styles.pressed
              ]}
            >
              <Ionicons
                name={meta.icon as never}
                size={22}
                color={focused ? colors.primary : colors.textSubtle}
              />
              <Text style={[styles.label, focused && styles.labelActive]}>
                {isApprovedPlumber && routeName === "catalog" ? "Наличие" : isApprovedPlumber && routeName === "orders" ? "Резервы" : meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    alignItems: "center"
  },
  bar: {
    width: "100%",
    maxWidth: 374,
    minHeight: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadows.tabBar
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 56,
    borderRadius: radius.lg
  },
  tabActive: {
    backgroundColor: colors.primarySoft
  },
  label: {
    color: colors.textSubtle,
    fontSize: typography.tiny,
    fontWeight: "800"
  },
  labelActive: {
    color: colors.primary
  },
  pressed: {
    opacity: 0.82
  }
});
