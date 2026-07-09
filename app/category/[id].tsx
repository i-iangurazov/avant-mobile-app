import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, type TextStyle, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ProductCard } from "../../src/components/ProductCard";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, typography } from "../../src/constants/theme";
import {
  useAddToCart,
  useCategories,
  useProductsByCategory,
  type ProductSort
} from "../../src/hooks/useCatalog";
import { useToast } from "../../src/hooks/useToast";
import { friendlyError } from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";
import type { Product } from "../../src/types";

const sortOptions: { label: string; value: ProductSort }[] = [
  { label: "По названию", value: "name" },
  { label: "Сначала дешевле", value: "price_asc" },
  { label: "Сначала дороже", value: "price_desc" }
];

export default function CategoryProductsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categories = useCategories();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProductSort>("name");
  const addToCart = useAddToCart();
  const { showToast } = useToast();
  const products = useProductsByCategory(id, search, "all", sort);

  const category = useMemo(
    () => categories.data?.find((item) => item.id === id),
    [categories.data, id]
  );

  const addProduct = async (product: Product) => {
    try {
      await addToCart.mutateAsync({ productId: product.id, product });
      showToast({
        title: "Добавлено в корзину",
        message: product.name,
        variant: "success"
      });
    } catch (error) {
      Alert.alert("Не удалось добавить товар", friendlyError(error instanceof Error ? error.message : undefined));
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productItem}>
      <ProductCard
        product={item}
        onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
        onAdd={() => void addProduct(item)}
      />
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.headerBlock}>
        <ScreenHeader
          title={category?.name ?? "Категория"}
          subtitle="Все товары"
          onBack={() => safeBack("/catalog")}
        />
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.textSubtle} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Поиск по товарам"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              style={[styles.searchInput, webInputReset]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Поиск по фото"
            onPress={() => router.push("/image-search")}
            style={styles.photoButton}
          >
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.chips}>
          {sortOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => setSort(option.value)}
              style={[styles.neutralChip, sort === option.value && styles.chipActive]}
            >
              <Ionicons name="swap-vertical-outline" size={15} color={sort === option.value ? colors.surface : colors.textMuted} />
              <Text style={[styles.neutralChipText, sort === option.value && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {products.isLoading ? <LoadingState text="Загружаем товары..." /> : null}
      {products.isError ? (
        <ErrorState message={products.error.message} onRetry={() => void products.refetch()} />
      ) : null}
      {!products.isLoading && !products.isError ? (
        <FlatList
          data={products.data ?? []}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="Ничего не найдено"
              text="Попробуйте изменить запрос или обновить каталог."
              icon="search-outline"
            />
          }
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
  headerBlock: {
    backgroundColor: colors.surface
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  searchBox: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body
  },
  photoButton: {
    width: 48,
    minHeight: 48,
    paddingHorizontal: 0,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  chips: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexWrap: "wrap"
  },
  neutralChip: {
    minHeight: 34,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  neutralChipText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "800"
  },
  chipActive: {
    backgroundColor: colors.primary
  },
  chipTextActive: {
    color: colors.surface
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120
  },
  productRow: {
    gap: spacing.md,
    marginBottom: spacing.md
  },
  productItem: {
    flex: 1
  }
});

const webInputReset = { outlineStyle: "none" } as unknown as TextStyle;
