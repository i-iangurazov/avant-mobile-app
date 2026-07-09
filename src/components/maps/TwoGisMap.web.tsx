import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { TWO_GIS_FIRM_IDS } from "../../data/stores";

const iframeStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  border: 0
};

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
  const mapUrl = useMemo(buildMapUrl, []);

  return (
    <View style={styles.container}>
      {React.createElement("iframe", {
        src: mapUrl,
        title: "Карта магазинов Авантехник 2GIS",
        style: iframeStyle
      })}
      <View style={styles.mapLabel}>
        <Ionicons name="map-outline" size={16} color={colors.primary} />
        <Text style={styles.mapLabelText}>2GIS карта Авантехник</Text>
      </View>
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
  mapLabel: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    minHeight: 36,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    ...shadows.card
  },
  mapLabelText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900"
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
  }
});
