import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";
import { formatPrice } from "../lib/formatters";
import type { Product } from "../types";
import { AppButton } from "./AppButton";
import { ProductImagePlaceholder } from "./ProductImagePlaceholder";

type ProductCardProps = {
  product: Product;
  onPress: () => void;
  onAdd: () => void;
};

export function ProductCard({
  product,
  onPress,
  onAdd
}: ProductCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.imagePressable}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <ProductImagePlaceholder />
          )}
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress}>
        <View style={styles.body}>
          <Text style={styles.category}>{product.category?.name ?? product.brand ?? "Товар"}</Text>
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.price}>{formatPrice(product.price, product.price_label ?? "Цена уточняется")}</Text>
        </View>
      </Pressable>
      <View style={styles.buttonWrap}>
        <AppButton title="В корзину" onPress={onAdd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.card
  },
  imageWrap: {
    height: 150,
    backgroundColor: colors.surfaceMuted
  },
  imagePressable: {
    flex: 1
  },
  image: {
    width: "100%",
    height: "100%"
  },
  body: {
    padding: spacing.md,
    gap: 4
  },
  category: {
    color: colors.textSubtle,
    fontSize: typography.tiny,
    fontWeight: "700"
  },
  name: {
    minHeight: 40,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    lineHeight: 19
  },
  price: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900"
  },
  buttonWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md
  }
});
