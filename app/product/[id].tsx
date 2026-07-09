import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { ProductImagePlaceholder } from "../../src/components/ProductImagePlaceholder";
import { QuantityStepper } from "../../src/components/QuantityStepper";
import { colors, radius, shadows, spacing, typography } from "../../src/constants/theme";
import { useAddToCart, useProduct } from "../../src/hooks/useCatalog";
import { useStores } from "../../src/hooks/useStores";
import { useToast } from "../../src/hooks/useToast";
import { formatPrice, friendlyError } from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";
import { openWhatsApp } from "../../src/lib/whatsapp";

type DetailTab = "desc" | "specs" | "stores";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const stores = useStores();
  const addToCart = useAddToCart();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<DetailTab>("desc");

  const addProduct = async () => {
    if (!product.data) {
      return;
    }

    try {
      await addToCart.mutateAsync({ productId: product.data.id, product: product.data, quantity });
      showToast({
        title: "Добавлено в корзину",
        message: `${product.data.name} x ${quantity}`,
        variant: "success"
      });
    } catch (error) {
      Alert.alert("Не удалось добавить товар", friendlyError(error instanceof Error ? error.message : undefined));
    }
  };

  if (product.isLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <LoadingState text="Загружаем товар..." />
      </SafeAreaView>
    );
  }

  if (product.isError || !product.data) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ErrorState message={product.error?.message ?? "Товар не найден"} onRetry={() => void product.refetch()} />
      </SafeAreaView>
    );
  }

  const currentProduct = product.data;
  const priceUnavailable = currentProduct.price === null || currentProduct.price === undefined;
  const askInWhatsApp = async () => {
    try {
      await openWhatsApp(`Здравствуйте! Хочу уточнить наличие товара: ${currentProduct.name}`);
    } catch (error) {
      Alert.alert("WhatsApp", friendlyError(error instanceof Error ? error.message : undefined));
    }
  };
  const characteristics = [
    ["Артикул", currentProduct.sku],
    ["Бренд", currentProduct.brand],
    ["Материал", currentProduct.material],
    ["Размер", currentProduct.size],
    ["Назначение", currentProduct.purpose]
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => safeBack("/catalog")} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.imageWrap}>
          {currentProduct.image_url ? (
            <Image source={{ uri: currentProduct.image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <ProductImagePlaceholder />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>{currentProduct.name}</Text>
          <Text style={styles.price}>{formatPrice(currentProduct.price, currentProduct.price_label ?? "Цена уточняется")}</Text>

          <View style={styles.tabs}>
            {[
              ["desc", "Описание"],
              ["specs", "Характеристики"],
              ["stores", "Наличие"]
            ].map(([tabId, label]) => (
              <Pressable
                key={tabId}
                accessibilityRole="button"
                onPress={() => setTab(tabId as DetailTab)}
                style={[styles.tab, tab === tabId && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab === tabId && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "desc" ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Описание</Text>
              <Text style={styles.description}>{currentProduct.description ?? "Описание товара будет добавлено позже."}</Text>
            </View>
          ) : null}

          {tab === "specs" ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Характеристики</Text>
              {characteristics.length ? (
                characteristics.map(([label, value]) => (
                  <View key={label} style={styles.specRow}>
                    <Text style={styles.specLabel}>{label}</Text>
                    <Text style={styles.specValue}>{value}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.description}>Характеристики уточняются.</Text>
              )}
            </View>
          ) : null}

          {tab === "stores" ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Наличие в магазинах</Text>
              <Text style={styles.description}>Точные остатки по каждой точке продаж уточнит менеджер.</Text>
              {(stores.data ?? []).map((store) => (
                <View key={store.id} style={styles.storeRow}>
                  <View style={styles.storeDot} />
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>{store.name}</Text>
                    <Text style={styles.storeAddress}>{store.address}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      void openWhatsApp(`Здравствуйте! Хочу уточнить наличие товара: ${currentProduct.name}. Магазин: ${store.name}, ${store.address}`)
                    }
                    style={styles.storeStatusButton}
                  >
                    <Text style={styles.storeStatus}>Уточнить</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <QuantityStepper
          value={quantity}
          onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
          onIncrease={() => setQuantity((value) => value + 1)}
          onChange={setQuantity}
        />
        <View style={styles.ctaButton}>
          <AppButton
            title={priceUnavailable ? "Уточнить в WhatsApp" : "Добавить в корзину"}
            onPress={priceUnavailable ? () => void askInWhatsApp() : () => void addProduct()}
            loading={!priceUnavailable && addToCart.isPending}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  iconSpacer: {
    width: 42,
    height: 42
  },
  content: {
    backgroundColor: colors.surface
  },
  imageWrap: {
    height: 290,
    backgroundColor: colors.surfaceMuted
  },
  image: {
    width: "100%",
    height: "100%"
  },
  info: {
    padding: spacing.xl,
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 30
  },
  price: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900"
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: 4,
    marginTop: spacing.sm
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.card
  },
  tabText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "800"
  },
  tabTextActive: {
    color: colors.primary
  },
  section: {
    gap: spacing.md,
    marginTop: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900"
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23
  },
  specRow: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg
  },
  specLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.small
  },
  specValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    textAlign: "right"
  },
  storeRow: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  storeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  storeInfo: {
    flex: 1
  },
  storeName: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900"
  },
  storeAddress: {
    color: colors.textSubtle,
    fontSize: typography.tiny,
    marginTop: 2
  },
  storeStatus: {
    color: colors.primary,
    fontSize: typography.tiny,
    fontWeight: "900"
  },
  storeStatusButton: {
    minHeight: 36,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  ctaButton: {
    flex: 1
  }
});
