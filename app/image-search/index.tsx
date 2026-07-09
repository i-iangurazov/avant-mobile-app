import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../src/components/AppButton";
import { LoadingState } from "../../src/components/LoadingState";
import { ProductCard } from "../../src/components/ProductCard";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { colors, radius, spacing, typography } from "../../src/constants/theme";
import { useAddToCart } from "../../src/hooks/useCatalog";
import { useUploadImageSearch } from "../../src/hooks/useImageSearch";
import { useToast } from "../../src/hooks/useToast";
import { friendlyError } from "../../src/lib/formatters";
import { safeBack } from "../../src/lib/navigation/safeBack";
import type { Product } from "../../src/types";

export default function ImageSearchScreen() {
  const addToCart = useAddToCart();
  const uploadImage = useUploadImageSearch();
  const { showToast } = useToast();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [resultMessage, setResultMessage] = useState("Поиск по фото будет доступен после подключения сервиса распознавания товаров.");
  const [results, setResults] = useState<Product[]>([]);

  const pickImage = async (source: "camera" | "library") => {
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: false,
          mediaTypes: ImagePicker.MediaTypeOptions.Images
        });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setImageUri(asset.uri);

    try {
      const result = await uploadImage.mutateAsync(asset);
      setResultMessage(result.message);
      setResults(result.products);
      setUploaded(true);
    } catch (error) {
      Alert.alert("Не удалось загрузить фото", friendlyError(error instanceof Error ? error.message : undefined));
    }
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
      <ScreenHeader title="Поиск по фото" onBack={() => safeBack("/catalog")} />
      {!imageUri ? (
        <View style={styles.pickContent}>
          <View style={styles.cameraIcon}>
            <Ionicons name="camera-outline" size={54} color={colors.primary} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title}>Поиск по фото</Text>
            <Text style={styles.subtitle}>Сфотографируйте товар или загрузите изображение. Приложение проверит, подключён ли сервис поиска похожих товаров.</Text>
          </View>
          <View style={styles.actions}>
            <AppButton
              title="Сделать фото"
              onPress={() => void pickImage("camera")}
              loading={uploadImage.isPending}
              icon={<Ionicons name="camera-outline" size={18} color={colors.surface} />}
            />
            <AppButton
              title="Загрузить из галереи"
              variant="secondary"
              onPress={() => void pickImage("library")}
              loading={uploadImage.isPending}
              icon={<Ionicons name="image-outline" size={18} color={colors.primary} />}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.resultsHeader}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              <View style={styles.resultTextWrap}>
                <Text style={styles.resultTitle}>
                  {results.length ? "Похожие товары" : uploaded ? "Фото загружено" : "Загрузка фото"}
                </Text>
                <Text style={styles.resultSubtitle}>
                  {resultMessage}
                </Text>
              </View>
              {uploadImage.isPending ? <LoadingState text="Проверяем изображение..." /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setImageUri(null);
                  setUploaded(false);
                  setResults([]);
                  setResultMessage("Поиск по фото будет доступен после подключения сервиса распознавания товаров.");
                }}
                style={styles.changePhoto}
              >
                <Text style={styles.changePhotoText}>Выбрать другое фото</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface
  },
  pickContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.xl
  },
  cameraIcon: {
    width: 116,
    height: 116,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center"
  },
  textBlock: {
    alignItems: "center",
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "900",
    textAlign: "center"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: "center"
  },
  actions: {
    gap: spacing.md
  },
  resultsContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 32
  },
  resultsHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  preview: {
    width: "100%",
    height: 190,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMuted
  },
  resultTextWrap: {
    gap: 4
  },
  resultTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900"
  },
  resultSubtitle: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 18
  },
  changePhoto: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm
  },
  changePhotoText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "900"
  },
  productRow: {
    gap: spacing.md,
    marginBottom: spacing.md
  },
  productItem: {
    flex: 1
  }
});
