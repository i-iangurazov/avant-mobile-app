import {SelectField} from "../../../src/components/SelectField";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { StoreCard } from "../../../src/components/StoreCard";
import { TwoGisMap } from "../../../src/components/maps/TwoGisMap";
import { colors, spacing, typography } from "../../../src/constants/theme";
import { useStores } from "../../../src/hooks/useStores";

export default function MapsScreen() {
  const stores = useStores();
  const [selectedStoreId, setSelectedStoreId] = useState("store-1");
  const [mapInteracting, setMapInteracting] = useState(false);
  const selectedStore = useMemo(
    () => stores.data?.find((store) => store.id === selectedStoreId) ?? stores.data?.[0],
    [selectedStoreId, stores.data]
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapInteracting}
        nestedScrollEnabled
      >
        <View style={styles.header}>
          <Text style={styles.title}>Магазины</Text>
          <Text style={styles.subtitle}>Точки продаж и самовывоза в Бишкеке</Text>
        </View>

        {stores.isLoading ? <LoadingState text="Загружаем магазины..." /> : null}
        {stores.isError ? <ErrorState message={stores.error.message} onRetry={() => void stores.refetch()} /> : null}

        {!stores.isLoading && !stores.isError ? (
          <>
            <View style={{padding:spacing.xl}}><SelectField label="Филиал" value={selectedStore?.id??null} options={(stores.data??[]).map(store=>({value:store.id,label:store.name,description:store.address}))} onChange={setSelectedStoreId} searchable/></View>

            <TwoGisMap
              firmId={selectedStore?.two_gis_firm_id}
              storeName={selectedStore?.name ?? "Авантехник"}
              onInteractionChange={setMapInteracting}
              onSelectFirm={firmId=>{const store=stores.data?.find(item=>item.two_gis_firm_id===firmId);if(store)setSelectedStoreId(store.id);}}
            />

            <View style={styles.cards}>
              {(selectedStore ? [selectedStore] : []).map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </View>
          </>
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
    paddingBottom: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textSubtle,
    fontSize: typography.small,
    fontWeight: "700",
    marginTop: 2
  },
  storeTabs: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.sm
  },
  storeTab: {
    minHeight: 38,
    maxWidth: 190,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  storeTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  storeTabText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "800"
  },
  storeTabTextActive: {
    color: colors.surface
  },
  cards: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    alignItems: "stretch"
  }
});
