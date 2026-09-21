import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { LoadingState } from '../../../src/components/LoadingState';
import { OrderCard } from '../../../src/components/OrderCard';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { colors, spacing, typography } from '../../../src/constants/theme';
import { useAuth } from '../../../src/hooks/useAuth';
import { telegramDeliveryLabel, useAdminOrders } from '../../../src/hooks/useAdminOrders';
import { safeBack } from '../../../src/lib/navigation/safeBack';

export default function AdminOrdersScreen() {
  const { user } = useAuth();
  const orders = useAdminOrders();
  const rows = orders.data?.pages.flatMap(page => page.data) ?? [];
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <ScreenHeader title="Заказы покупателей" onBack={() => safeBack('/admin')} />
    {!user?.isAdmin ? <EmptyState title={user ? 'Нет доступа' : 'Войдите как администратор'} actionTitle={!user ? 'Войти' : undefined} onAction={!user ? () => router.push('/login') : undefined} /> : <>
      {orders.isLoading ? <LoadingState text="Загружаем заказы..." /> : null}
      <FlatList data={rows} keyExtractor={item => item.id} contentContainerStyle={styles.content}
        refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()}
        ListHeaderComponent={<><Text style={styles.help}>Здесь отображаются все заказы покупателей. Статусы обновляются после действий в Telegram.</Text><AppButton title="Обновить заказы" variant="secondary" loading={orders.isRefetching} onPress={() => void orders.refetch()} /></>}
        ListEmptyComponent={!orders.isLoading && !orders.isError ? <EmptyState title="Заказов пока нет" text="Новые заказы появятся здесь сразу после оформления." /> : null}
        renderItem={({ item }) => <View style={styles.row}><OrderCard order={item} onPress={() => router.push({ pathname: '/admin/orders/[id]', params: { id: item.id } })} /><Text style={styles.delivery}>{telegramDeliveryLabel(item.notificationStatus)}</Text></View>}
        ListFooterComponent={<>{orders.isError ? <ErrorState message={orders.error.message} onRetry={() => void orders.refetch()} /> : null}{orders.hasNextPage ? <AppButton title="Загрузить ещё" variant="secondary" loading={orders.isFetchingNextPage} onPress={() => void orders.fetchNextPage()} /> : null}</>} />
    </>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.lg }, row: { gap: spacing.sm }, help: { fontSize: typography.small, color: colors.textMuted, marginBottom: spacing.md }, delivery: { fontSize: typography.small, color: colors.textMuted, paddingHorizontal: spacing.sm } });
