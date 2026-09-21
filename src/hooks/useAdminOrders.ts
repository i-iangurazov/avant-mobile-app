import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { appApiClient } from '../lib/api/client';
import { adaptOrder, adaptOrderDetail } from '../lib/bazaar/adapters';

type RawOrder = Record<string, unknown> & { telegram_notification_status: string };
export const telegramDeliveryLabel = (status: string) => ({
  sent: 'Telegram: отправлено', pending: 'Telegram: ожидает отправки',
  sending: 'Telegram: отправляется', failed: 'Telegram: отправка повторится'
}[status] || 'Telegram: статус доставки неизвестен');

export function useAdminOrders() {
  const { user, session } = useAuth();
  return useInfiniteQuery({
    queryKey: ['admin-orders', user?.id], enabled: user?.isAdmin === true,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const response = await appApiClient.request<{ data: RawOrder[]; nextCursor: string | null }>(
        '/admin/orders' + (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''),
        { headers: { Authorization: `Bearer ${session?.accessToken}` } });
      return { data: response.data.map(row => ({ ...adaptOrder(row), notificationStatus: row.telegram_notification_status })), nextCursor: response.nextCursor };
    },
    getNextPageParam: page => page.nextCursor,
    refetchInterval: 15_000
  });
}

export function useAdminOrder(id?: string) {
  const { user, session } = useAuth();
  return useQuery({
    queryKey: ['admin-order', user?.id, id], enabled: user?.isAdmin === true && Boolean(id),
    queryFn: async () => {
      const response = await appApiClient.request<{ data: RawOrder }>('/admin/orders/' + encodeURIComponent(id!),
        { headers: { Authorization: `Bearer ${session?.accessToken}` } });
      return { ...adaptOrderDetail(response), notificationStatus: response.data.telegram_notification_status };
    },
    refetchInterval: 10_000
  });
}
