import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { StoreCard } from "../../../src/components/StoreCard";
import { TwoGisMap } from "../../../src/components/maps/TwoGisMap";
import { colors, spacing, typography } from "../../../src/constants/theme";
import { useStores } from "../../../src/hooks/useStores";

export default function MapsScreen() {
  const stores = useStores();

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Магазины</Text>
          <Text style={styles.subtitle}>Точки продаж и самовывоза в Бишкеке</Text>
        </View>

        {stores.isLoading ? <LoadingState text="Загружаем магазины..." /> : null}
        {stores.isError ? <ErrorState message={stores.error.message} onRetry={() => void stores.refetch()} /> : null}

        {!stores.isLoading && !stores.isError ? (
          <>
            <TwoGisMap />

            <View style={styles.cards}>
              {(stores.data ?? []).map((store) => (
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
  cards: {
    marginTop: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    alignItems: "stretch"
  }
});
