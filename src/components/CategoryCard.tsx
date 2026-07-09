import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";
import type { Category } from "../types";

type CategoryCardProps = {
  category: Category;
  onPress: () => void;
};

const iconByCategoryId: Record<string, string> = {
  "all-products": "grid-outline",
  mixers: "water-outline",
  sinks: "ellipse-outline",
  showers: "rainy-outline",
  toilets: "cube-outline",
  "pipes-fittings": "git-network-outline",
  heating: "flame-outline",
  "water-supply": "water-outline",
  filters: "filter-outline",
  tools: "construct-outline",
  accessories: "albums-outline",
  other: "cube-outline"
};

export function CategoryCard({ category, onPress }: CategoryCardProps) {
  const icon = iconByCategoryId[category.id] ?? "cube-outline";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {category.image_url ? (
        <Image source={{ uri: category.image_url }} style={styles.categoryImage} resizeMode="cover" />
      ) : (
        <View style={styles.iconWrap}>
          <Ionicons name={icon as never} size={24} color={colors.primary} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={2}>{category.name}</Text>
      <Text style={styles.count}>{category.product_count ?? 0} товаров</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 142,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  categoryImage: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft
  },
  name: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20
  },
  count: {
    color: colors.textSubtle,
    fontSize: typography.small,
    fontWeight: "600"
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92
  }
});
