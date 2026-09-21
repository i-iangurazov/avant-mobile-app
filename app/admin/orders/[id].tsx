import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { LoadingState } from '../../../src/components/LoadingState';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { colors, radius, spacing, typography } from '../../../src/constants/theme';
import { useAuth } from '../../../src/hooks/useAuth';
import { telegramDeliveryLabel, useAdminOrder } from '../../../src/hooks/useAdminOrders';
import { formatDate, formatPrice } from '../../../src/lib/formatters';
import { safeBack } from '../../../src/lib/navigation/safeBack';

export default function AdminOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const order = useAdminOrder(id);
  const value = order.data;
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <ScreenHeader title={value ? `Заказ ${value.order_number}` : 'Заказ покупателя'} onBack={() => safeBack('/admin/orders')} />
    {!user?.isAdmin ? <EmptyState title="Доступно только администратору" /> : <ScrollView contentContainerStyle={styles.content}>
      {order.isLoading ? <LoadingState text="Загружаем заказ..." /> : null}
      {order.isError ? <ErrorState message={order.error.message} onRetry={() => void order.refetch()} /> : null}
      {value ? <>
        <View style={styles.card}><StatusBadge status={value.status} /><Text style={styles.title}>{formatPrice(value.total_amount, value.total_label ?? 'Уточняется менеджером')}</Text><Text style={styles.text}>{formatDate(value.created_at)}</Text><Text style={styles.text}>{telegramDeliveryLabel(value.notificationStatus)}</Text></View>
        <View style={styles.card}><Text style={styles.title}>Покупатель</Text><Text selectable style={styles.text}>{value.customer_name}</Text><Text selectable style={styles.text}>{value.customer_phone}</Text><Text style={styles.text}>{value.delivery_method === 'delivery' ? `Доставка: ${value.delivery_address || 'Адрес не указан'}` : `Самовывоз: ${value.store?.name || 'Филиал не указан'}`}</Text>{value.store?.address ? <Text style={styles.text}>{value.store.address}</Text> : null}{value.comment ? <Text style={styles.text}>{value.comment}</Text> : null}{value.project_note ? <Text style={styles.text}>{value.project_note}</Text> : null}</View>
        <View style={styles.card}><Text style={styles.title}>Товары</Text>{value.order_items.map(item => <View key={item.id} style={styles.item}><Text style={styles.text}>{item.product_name}</Text><Text style={styles.text}>{item.quantity} × {formatPrice(item.unit_price, item.unit_price_label ?? 'Цена уточняется')}</Text></View>)}</View>
        <View style={styles.card}><Text style={styles.title}>История статусов</Text>{value.order_status_events.map(event => <Text key={event.id} style={styles.text}>{event.label} · {formatDate(event.created_at)}</Text>)}</View>
        <AppButton title="Обновить статус" variant="secondary" loading={order.isRefetching} onPress={() => void order.refetch()} />
      </> : null}
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: spacing.lg }, card: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg }, title: { color: colors.text, fontSize: typography.subheading, fontWeight: '800' }, text: { color: colors.textMuted, fontSize: typography.body }, item: { gap: spacing.sm } });
