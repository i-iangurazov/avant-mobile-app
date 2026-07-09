import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { TWO_GIS_FIRM_IDS, TWO_GIS_OPEN_URL } from "../../data/stores";

const buildMapUrl = () => {
  const options = {
    pos: {
      lat: 42.88904574206037,
      lon: 74.60369110107423,
      zoom: 12
    },
    opt: {
      city: "bishkek"
    },
    org: TWO_GIS_FIRM_IDS.join(",")
  };

  return `https://widgets.2gis.com/widget?type=firmsonmap&options=${encodeURIComponent(
    JSON.stringify(options)
  )}`;
};

export function TwoGisMap() {
  const [hasError, setHasError] = useState(false);
  const mapUrl = useMemo(buildMapUrl, []);

  const openInTwoGis = () => {
    void Linking.openURL(TWO_GIS_OPEN_URL);
  };

  if (hasError) {
    return (
      <View style={styles.fallback}>
        <View style={styles.fallbackIcon}>
          <Ionicons name="map-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.fallbackTitle}>Карта магазинов</Text>
        <Text style={styles.fallbackText}>
          Карта 2GIS временно не загрузилась. Попробуйте ещё раз.
        </Text>

        <Pressable accessibilityRole="button" onPress={() => setHasError(false)} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Повторить</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={openInTwoGis} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Открыть в 2GIS</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: mapUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        mixedContentMode="always"
        originWhitelist={["*"]}
        onError={() => setHasError(true)}
        onHttpError={() => setHasError(true)}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      />
      <View style={styles.widgetCtaCover}>
        <Ionicons name="storefront-outline" size={15} color={colors.primary} />
        <Text style={styles.widgetCtaCoverText}>6 магазинов</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 560,
    margin: spacing.xl,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    ...shadows.card
  },
  webview: {
    flex: 1,
    backgroundColor: colors.surfaceMuted
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted
  },
  widgetCtaCover: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    minWidth: 118,
    minHeight: 36,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    zIndex: 5,
    ...shadows.card
  },
  widgetCtaCoverText: {
    color: colors.text,
    fontSize: typography.tiny,
    fontWeight: "900"
  },
  fallback: {
    margin: spacing.xl,
    minHeight: 360,
    borderRadius: radius.xl,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    ...shadows.card
  },
  fallbackIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  fallbackTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: "900",
    textAlign: "center"
  },
  fallbackText: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 19,
    textAlign: "center"
  },
  primaryButton: {
    marginTop: spacing.xs,
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: typography.small,
    fontWeight: "800"
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: "800"
  }
});
