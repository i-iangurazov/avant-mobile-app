import { Platform } from "react-native";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const appName = process.env.EXPO_PUBLIC_APP_NAME || "Авантехник";

export const bazaarProxyBaseUrl = trimTrailingSlash(
  (Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_BAZAAR_PROXY_URL_WEB || process.env.EXPO_PUBLIC_BAZAAR_PROXY_URL
    : process.env.EXPO_PUBLIC_BAZAAR_PROXY_URL) || ""
);

export const whatsAppBusinessPhone =
  process.env.EXPO_PUBLIC_WHATSAPP_BUSINESS_PHONE ||
  process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE ||
  "";

export const twoGisSearchUrl =
  process.env.EXPO_PUBLIC_2GIS_SEARCH_URL ||
  "https://2gis.kg/bishkek/search/%D0%90%D0%B2%D0%B0%D0%BD%D1%82%D0%B5%D1%85%D0%BD%D0%B8%D0%BA";

export const imageSearchEnabled = process.env.EXPO_PUBLIC_IMAGE_SEARCH_ENABLED === "true";

export const imageSearchEndpoint = trimTrailingSlash(process.env.EXPO_PUBLIC_IMAGE_SEARCH_URL || "");

export const debugApiErrors = process.env.EXPO_PUBLIC_DEBUG_API_ERRORS === "true";

export const hasBazaarApiConfig = Boolean(bazaarProxyBaseUrl);
