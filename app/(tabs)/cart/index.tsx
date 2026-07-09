import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../../src/components/AppButton";
import { EmptyState } from "../../../src/components/EmptyState";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { ProductImagePlaceholder } from "../../../src/components/ProductImagePlaceholder";
import { QuantityStepper } from "../../../src/components/QuantityStepper";
import { colors, radius, shadows, spacing, typography } from "../../../src/constants/theme";
import { useCart, useCartMutations } from "../../../src/hooks/useCart";
import { formatPrice, friendlyError } from "../../../src/lib/formatters";
import type { CartItemWithProduct } from "../../../src/types";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { updateQuantity, removeItem } = useCartMutations();
  const items = cart.data?.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const tabBarOffset = 96 + insets.bottom;

  const updateItem = async (itemId: string, quantity: number) => {
    try {
      await updateQuantity.mutateAsync({ itemId, quantity });
    } catch (error) {
      Alert.alert("Корзина", friendlyError(error instanceof Error ? error.message : undefined));
    }
  };

  const remove = async (itemId: string) => {
    try {
      await removeItem.mutateAsync(itemId);
    } catch (error) {
      Alert.alert("Корзина", friendlyError(error instanceof Error ? error.message : undefined));
    }
  };

  const renderItem = ({ item }: { item: CartItemWithProduct }) => (
    <View style={styles.itemCard}>
      {item.product?.image_url ? (
        <Image source={{ uri: item.product.image_url }} style={styles.itemImage} resizeMode="cover" />
      ) : (
        <ProductImagePlaceholder compact style={styles.itemImage} />
      )}
      <View style={styles.itemBody}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={2}>{item.product?.name ?? "Товар"}</Text>
          <Pressable accessibilityRole="button" onPress={() => void remove(item.id)} style={styles.removeButton}>
            <Ionicons name="close" size={18} color={colors.textSubtle} />
          </Pressable>
        </View>
        <Text style={styles.itemPrice}>
          {formatPrice(item.product?.price, item.product?.price_label ?? "Цена уточняется")}
        </Text>
        <QuantityStepper
          value={item.quantity}
          onDecrease={() => void updateItem(item.id, item.quantity - 1)}
          onIncrease={() => void updateItem(item.id, item.quantity + 1)}
          onChange={(quantity) => void updateItem(item.id, quantity)}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Корзина</Text>
        <Text style={styles.subtitle}>Товары: {itemCount}</Text>
      </View>

      {cart.isLoading ? <LoadingState text="Загружаем корзину..." /> : null}
      {cart.isError ? <ErrorState message={cart.error.message} onRetry={() => void cart.refetch()} /> : null}
      {!cart.isLoading && !cart.isError && items.length === 0 ? (
        <EmptyState
          title="Корзина пуста"
          text="Добавьте товары из каталога, чтобы оформить заказ"
          icon="cart-outline"
          actionTitle="Перейти в каталог"
          onAction={() => router.push("/catalog")}
        />
      ) : null}
      {!cart.isLoading && !cart.isError && items.length ? (
        <>
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: 310 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          />
          <View style={[styles.summary, { bottom: tabBarOffset }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Товары: {itemCount}</Text>
              <Text style={styles.summaryLabel}>Доставка: уточняется</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Итого</Text>
              <Text style={styles.totalValue}>уточняется менеджером</Text>
            </View>
            <AppButton title="Оформить заказ" onPress={() => router.push("/checkout")} />
          </View>
        </>
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
    gap: spacing.md
  },
  itemCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card
  },
  itemImage: {
    width: 82,
    height: 82,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  itemBody: {
    flex: 1,
    gap: spacing.sm
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  itemName: {
    flex: 1,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900",
    lineHeight: 19
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  itemPrice: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900"
  },
  summary: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "700"
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  totalLabel: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900"
  },
  totalValue: {
    flex: 1,
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900",
    textAlign: "right"
  }
});
