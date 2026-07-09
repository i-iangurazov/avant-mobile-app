import type * as ImagePicker from "expo-image-picker";
import type { Product } from "../../types";
import { bazaarProxyBaseUrl } from "../config/env";
import { normalizeApiError } from "../errors/normalizeApiError";
import { adaptProducts } from "../bazaar/adapters";

export type ImageSearchResult = {
  message: string;
  products: Product[];
};

export async function requestImageSearch(asset: ImagePicker.ImagePickerAsset): Promise<ImageSearchResult> {
  if (!bazaarProxyBaseUrl) {
    return {
      message: "Поиск по фото будет доступен после подключения сервиса распознавания товаров.",
      products: []
    };
  }

  const formData = new FormData();
  formData.append("image", {
    uri: asset.uri,
    name: asset.fileName ?? "product-photo.jpg",
    type: asset.mimeType ?? "image/jpeg"
  } as unknown as Blob);

  try {
    const response = await fetch(`${bazaarProxyBaseUrl}/image-search`, {
      method: "POST",
      body: formData
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) as unknown : null;

    if (response.status === 501 || response.status === 404) {
      return {
        message: "Поиск по фото будет доступен после подключения сервиса распознавания товаров.",
        products: []
      };
    }

    if (!response.ok) {
      throw new Error(normalizeApiError(payload));
    }

    const products = adaptProducts(payload);
    return {
      message: products.length
        ? "Мы нашли товары, похожие на фото."
        : "Похожие товары не найдены. Попробуйте другое фото или напишите менеджеру.",
      products
    };
  } catch (error) {
    return {
      message: normalizeApiError(error, "Поиск по фото временно недоступен. Попробуйте позже."),
      products: []
    };
  }
}
