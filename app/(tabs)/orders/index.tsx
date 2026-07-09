import { router } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../src/components/EmptyState";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { OrderCard } from "../../../src/components/OrderCard";
import { colors, spacing, typography } from "../../../src/constants/theme";
import { useAuth } from "../../../src/hooks/useAuth";
import { useOrders } from "../../../src/hooks/useOrders";
import type { OrderListItem } from "../../../src/types";

export default function OrdersScreen() {
  const { user } = useAuth();
  const orders = useOrders();

  const renderOrder = ({ item }: { item: OrderListItem }) => (
    <OrderCard
      order={item}
      onPress={() => router.push({ pathname: "/orders/[id]", params: { id: item.id } })}
    />
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Мои заказы</Text>
        <Text style={styles.subtitle}>{orders.data?.length ?? 0} заказов</Text>
      </View>
      {!user ? (
        <EmptyState
          title="Войдите в аккаунт"
          text="История заказов доступна после входа в аккаунт."
          icon="person-circle-outline"
          actionTitle="Войти"
          onAction={() => router.push("/login")}
        />
      ) : null}
      {user && orders.isLoading ? <LoadingState text="Загружаем заказы..." /> : null}
      {user && orders.isError ? <ErrorState message={orders.error.message} onRetry={() => void orders.refetch()} /> : null}
      {user && !orders.isLoading && !orders.isError && orders.data?.length === 0 ? (
        <EmptyState
          title="У вас пока нет заказов"
          text="Оформленные заказы будут отображаться здесь"
          icon="receipt-outline"
          actionTitle="Открыть каталог"
          onAction={() => router.push("/catalog")}
        />
      ) : null}
      {user && !orders.isLoading && !orders.isError && orders.data?.length ? (
        <FlatList
          data={orders.data}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textSubtle,
    fontSize: typography.small,
    fontWeight: "700",
    marginTop: 2
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 118,
    gap: spacing.md
  }
});
