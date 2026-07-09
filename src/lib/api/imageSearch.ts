import type * as ImagePicker from "expo-image-picker";
import type { Product } from "../../types";
import { bazaarProxyBaseUrl, imageSearchEnabled, imageSearchEndpoint } from "../config/env";
import { normalizeApiError } from "../errors/normalizeApiError";
import { adaptProducts } from "../bazaar/adapters";

export type ImageSearchResult = {
  message: string;
  products: Product[];
};

export async function requestImageSearch(asset: ImagePicker.ImagePickerAsset): Promise<ImageSearchResult> {
  if (!imageSearchEnabled) {
    return {
      message: "Фото принято. Автоматический поиск похожих товаров будет доступен после подключения сервиса распознавания. Сейчас менеджер поможет найти товар по фото в WhatsApp.",
      products: []
    };
  }

  const endpoint = imageSearchEndpoint || (bazaarProxyBaseUrl ? `${bazaarProxyBaseUrl}/image-search` : "");

  if (!endpoint) {
    return {
      message: "Фото принято. Сервис поиска по фото ещё не подключён.",
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
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) as unknown : null;

    if (response.status === 501 || response.status === 404) {
      return {
        message: "Фото принято. Автоматический поиск похожих товаров будет доступен после подключения сервиса распознавания. Сейчас менеджер поможет найти товар по фото в WhatsApp.",
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
