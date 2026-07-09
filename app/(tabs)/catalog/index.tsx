import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CategoryCard } from "../../../src/components/CategoryCard";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { ProductCard } from "../../../src/components/ProductCard";
import { assets } from "../../../src/constants/assets";
import { colors, radius, shadows, spacing, typography } from "../../../src/constants/theme";
import { useAddToCart, useCategories, usePopularProducts } from "../../../src/hooks/useCatalog";
import { useToast } from "../../../src/hooks/useToast";
import { friendlyError } from "../../../src/lib/formatters";
import type { Product } from "../../../src/types";

export default function CatalogScreen() {
  const categories = useCategories();
  const productsPreview = usePopularProducts(4);
  const addToCart = useAddToCart();
  const { showToast } = useToast();
  const allProducts = categories.data?.find((category) => category.id === "all-products");
  const realCategories = categories.data?.filter((category) => category.id !== "all-products") ?? [];
  const showCategories = categories.isLoading || categories.isError || realCategories.length > 0;

  const openAllProducts = () => {
    router.push({ pathname: "/category/[id]", params: { id: "all-products" } });
  };

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

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Каталог</Text>
            <View style={styles.location}>
              <Ionicons name="location-outline" size={14} color={colors.textSubtle} />
              <Text style={styles.locationText}>Бишкек</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push("/image-search")} style={styles.searchButton}>
            <Ionicons name="camera-outline" size={21} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.banner}>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Всё для ванной, отопления и ремонта</Text>
            <Text style={styles.bannerSubtitle}>Сантехника, трубы, фитинги, фильтры и инструменты для ремонта</Text>
            <Pressable
              accessibilityRole="button"
              onPress={openAllProducts}
              style={styles.bannerButton}
            >
              <Text style={styles.bannerButtonText}>Все товары</Text>
            </Pressable>
          </View>
          <Image source={assets.icon} style={styles.bannerIcon} resizeMode="contain" />
        </View>

        {showCategories ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Категории</Text>
              {realCategories.length ? (
                <Text style={styles.sectionMeta}>{realCategories.length} разделов</Text>
              ) : null}
            </View>

            {categories.isLoading ? <LoadingState text="Загружаем категории..." /> : null}
            {categories.isError ? (
              <ErrorState message={categories.error.message} onRetry={() => void categories.refetch()} />
            ) : null}
            {!categories.isLoading && !categories.isError && realCategories.length ? (
              <View style={styles.grid}>
                {realCategories.map((category) => (
                  <View key={category.id} style={styles.gridItem}>
                    <CategoryCard
                      category={category}
                      onPress={() => router.push({ pathname: "/category/[id]", params: { id: category.id } })}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Все товары</Text>
          <Pressable accessibilityRole="button" onPress={openAllProducts} style={styles.sectionAction}>
            <Text style={styles.sectionActionText}>
              {allProducts?.product_count ? `${allProducts.product_count} товаров` : "Открыть"}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.primary} />
          </Pressable>
        </View>

        {productsPreview.isLoading ? <LoadingState text="Загружаем товары..." /> : null}
        {productsPreview.isError ? (
          <ErrorState message={productsPreview.error.message} onRetry={() => void productsPreview.refetch()} />
        ) : null}
        {!productsPreview.isLoading && !productsPreview.isError && productsPreview.data?.length ? (
          <View style={styles.productsGrid}>
            {productsPreview.data.map((product) => (
              <View key={product.id} style={styles.productItem}>
                <ProductCard
                  product={product}
                  onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
                  onAdd={() => void addProduct(product)}
                />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingBottom: 118
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900"
  },
  location: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  locationText: {
    color: colors.textSubtle,
    fontSize: typography.small,
    fontWeight: "700"
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  banner: {
    margin: spacing.xl,
    borderRadius: radius.xl,
    padding: spacing.xl,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    ...shadows.card
  },
  bannerText: {
    flex: 1,
    gap: spacing.sm
  },
  bannerTitle: {
    color: colors.surface,
    fontSize: typography.subheading,
    fontWeight: "900",
    lineHeight: 22
  },
  bannerSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: typography.small,
    lineHeight: 18
  },
  bannerButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  bannerButtonText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900"
  },
  bannerIcon: {
    width: 72,
    height: 72,
    opacity: 0.92
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900"
  },
  sectionMeta: {
    color: colors.textSubtle,
    fontSize: typography.small,
    fontWeight: "700"
  },
  sectionAction: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: spacing.sm
  },
  sectionActionText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.md
  },
  gridItem: {
    width: "48%"
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.md
  },
  productItem: {
    width: "48%"
  }
});
