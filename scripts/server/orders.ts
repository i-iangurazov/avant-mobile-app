import { randomUUID } from "node:crypto";
import type pg from "pg";

export const ORDER_STATUS_LABELS = {
  created: "Заказ создан",
  confirmed: "Подтверждён",
  assembling: "Собирается",
  ready_for_pickup: "Готов к выдаче",
  on_the_way: "В пути",
  completed: "Завершён",
  cancelled: "Отменён"
} as const;

export type AppOrderStatus = keyof typeof ORDER_STATUS_LABELS;
export type DeliveryMethod = "pickup" | "delivery";

export type NewOrderItem = {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  unitPriceLabel: string | null;
};

export type NewOrder = {
  clientRequestId: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  storeId: string | null;
  storeName: string | null;
  storeAddress: string | null;
  deliveryAddress: string | null;
  comment: string | null;
  orderKind?: "order" | "reservation";
  projectNote?: string | null;
  items: NewOrderItem[];
};

type OrderRow = {
  id: string;
  order_number: string;
  client_request_id: string;
  customer_id: string;
  status: AppOrderStatus;
  customer_name: string;
  customer_phone: string;
  delivery_method: DeliveryMethod;
  store_id: string | null;
  store_name: string | null;
  store_address: string | null;
  delivery_address: string | null;
  comment: string | null;
  order_kind: "order" | "reservation";
  project_note: string | null;
  total_amount: string | number | null;
  telegram_chat_id: string | null;
  telegram_message_id: string | number | null;
  telegram_notification_status: string;
  telegram_notification_attempts: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: string | number | null;
  unit_price_label: string | null;
};

type StatusEventRow = {
  id: string;
  status: AppOrderStatus;
  label: string;
  source: string;
  created_at: Date | string;
};

export type AppOrderDetail = ReturnType<typeof toOrderDetail>;

const orderColumns = `
  id, order_number, client_request_id, customer_id, status,
  customer_name, customer_phone, delivery_method,
  store_id, store_name, store_address, delivery_address, comment,
  order_kind, project_note,
  total_amount, telegram_chat_id, telegram_message_id,
  telegram_notification_status, telegram_notification_attempts,
  created_at, updated_at
`;

const toIso = (value: Date | string) => new Date(value).toISOString();

const toOrderListItem = (row: OrderRow, itemCount: number) => ({
  id: row.id,
  order_number: row.order_number,
  status: row.status,
  created_at: toIso(row.created_at),
  updated_at: toIso(row.updated_at),
  item_count: itemCount,
  order_kind: row.order_kind,
  project_note: row.project_note,
  total_amount: row.total_amount,
  total_label: row.total_amount === null ? "Уточняется менеджером" : null
});

const toOrderDetail = (row: OrderRow, items: OrderItemRow[], events: StatusEventRow[]) => ({
  ...toOrderListItem(row, items.reduce((sum, item) => sum + item.quantity, 0)),
  customer_name: row.customer_name,
  customer_phone: row.customer_phone,
  delivery_method: row.delivery_method,
  delivery_address: row.delivery_address,
  store_id: row.store_id,
  comment: row.comment,
  order_kind: row.order_kind,
  project_note: row.project_note,
  store: row.store_id
    ? {
        id: row.store_id,
        name: row.store_name || "Авантехник",
        address: row.store_address || ""
      }
    : null,
  order_items: items.map((item) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit_price_label: item.unit_price_label
  })),
  order_status_events: events.map((event) => ({
    id: event.id,
    status: event.status,
    label: event.label,
    source: event.source,
    created_at: toIso(event.created_at)
  })),
  telegram: {
    chat_id: row.telegram_chat_id,
    message_id: row.telegram_message_id === null ? null : Number(row.telegram_message_id),
    notification_status: row.telegram_notification_status,
    notification_attempts: row.telegram_notification_attempts
  }
});

const getOrderRows = async (pool: pg.Pool, orderId: string, customerId?: string) => {
  const parameters: string[] = [orderId];
  const customerClause = customerId ? "AND customer_id = $2" : "";
  if (customerId) {
    parameters.push(customerId);
  }

  const order = await pool.query<OrderRow>(
    `SELECT ${orderColumns} FROM app_orders WHERE id = $1 ${customerClause} LIMIT 1`,
    parameters
  );

  if (!order.rows[0]) {
    return null;
  }

  const [items, events] = await Promise.all([
    pool.query<OrderItemRow>(
      `SELECT id, product_id, product_name, quantity, unit_price, unit_price_label
       FROM app_order_items WHERE order_id = $1 ORDER BY created_at ASC, id ASC`,
      [orderId]
    ),
    pool.query<StatusEventRow>(
      `SELECT id, status, label, source, created_at
       FROM app_order_status_events WHERE order_id = $1 ORDER BY created_at ASC, id ASC`,
      [orderId]
    )
  ]);

  return { row: order.rows[0], items: items.rows, events: events.rows };
};

export async function getAppOrder(pool: pg.Pool, orderId: string, customerId?: string) {
  const result = await getOrderRows(pool, orderId, customerId);
  return result ? toOrderDetail(result.row, result.items, result.events) : null;
}

export async function listAppOrders(pool: pg.Pool, customerId: string) {
  const result = await pool.query<OrderRow & { item_count: string | number }>(
    `SELECT orders.*, COALESCE(SUM(items.quantity), 0) AS item_count
     FROM app_orders orders
     LEFT JOIN app_order_items items ON items.order_id = orders.id
     WHERE customer_id = $1
     GROUP BY orders.id
     ORDER BY orders.created_at DESC`,
    [customerId]
  );

  return result.rows.map((row) => toOrderListItem(row, Number(row.item_count)));
}

const calculateTotal = (items: NewOrderItem[]) => {
  if (items.some((item) => item.unitPrice === null)) {
    return null;
  }
  return items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0);
};

export async function createAppOrder(pool: pg.Pool, customerId: string, payload: NewOrder) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM app_orders WHERE customer_id = $1 AND client_request_id = $2 LIMIT 1",
      [customerId, payload.clientRequestId]
    );

    if (existing.rows[0]) {
      await client.query("COMMIT");
      const order = await getAppOrder(pool, existing.rows[0].id, customerId);
      return { order, created: false };
    }

    const id = randomUUID();
    const sequence = await client.query<{ value: string }>(
      "SELECT nextval('app_order_number_seq')::text AS value"
    );
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const orderNumber = `AV-${date}-${sequence.rows[0].value.padStart(5, "0")}`;
    const total = calculateTotal(payload.items);

    await client.query(
      `INSERT INTO app_orders (
        id, order_number, client_request_id, customer_id, status,
        customer_name, customer_phone, delivery_method,
        store_id, store_name, store_address, delivery_address, comment, total_amount,
        order_kind, project_note
      ) VALUES ($1, $2, $3, $4, 'created', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        orderNumber,
        payload.clientRequestId,
        customerId,
        payload.customerName,
        payload.customerPhone,
        payload.deliveryMethod,
        payload.storeId,
        payload.storeName,
        payload.storeAddress,
        payload.deliveryAddress,
        payload.comment,
        total,
        payload.orderKind === "reservation" ? "reservation" : "order",
        payload.projectNote
      ]
    );

    for (const item of payload.items) {
      await client.query(
        `INSERT INTO app_order_items (
          id, order_id, product_id, product_name, quantity, unit_price, unit_price_label
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          id,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.unitPriceLabel
        ]
      );
    }

    await client.query(
      `INSERT INTO app_order_status_events (id, order_id, status, label, source)
       VALUES ($1, $2, 'created', $3, 'customer')`,
      [randomUUID(), id, ORDER_STATUS_LABELS.created]
    );

    await client.query("COMMIT");
    const order = await getAppOrder(pool, id, customerId);
    return { order, created: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function allowedNextStatuses(order: Pick<AppOrderDetail, "status" | "delivery_method">) {
  const fulfilmentStatus: AppOrderStatus =
    order.delivery_method === "pickup" ? "ready_for_pickup" : "on_the_way";
  const transitions: Partial<Record<AppOrderStatus, AppOrderStatus[]>> = {
    created: ["confirmed", "cancelled"],
    confirmed: ["assembling", "cancelled"],
    assembling: [fulfilmentStatus, "cancelled"],
    ready_for_pickup: ["completed", "cancelled"],
    on_the_way: ["completed", "cancelled"]
  };
  return transitions[order.status as AppOrderStatus] ?? [];
}

export async function updateAppOrderStatus(
  pool: pg.Pool,
  orderId: string,
  nextStatus: AppOrderStatus
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const current = await client.query<Pick<OrderRow, "status" | "delivery_method">>(
      "SELECT status, delivery_method FROM app_orders WHERE id = $1 FOR UPDATE",
      [orderId]
    );
    const row = current.rows[0];

    if (!row) {
      throw Object.assign(new Error("Заказ не найден."), { statusCode: 404 });
    }

    if (row.status === nextStatus) {
      await client.query("COMMIT");
      return { changed: false };
    }

    if (!allowedNextStatuses(row as AppOrderDetail).includes(nextStatus)) {
      throw Object.assign(new Error("Этот переход статуса недоступен."), { statusCode: 409 });
    }

    await client.query(
      "UPDATE app_orders SET status = $1, updated_at = now() WHERE id = $2",
      [nextStatus, orderId]
    );
    await client.query(
      `INSERT INTO app_order_status_events (id, order_id, status, label, source)
       VALUES ($1, $2, $3, $4, 'telegram_admin')`,
      [randomUUID(), orderId, nextStatus, ORDER_STATUS_LABELS[nextStatus]]
    );
    await client.query("COMMIT");
    return { changed: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markTelegramSent(
  pool: pg.Pool,
  orderId: string,
  chatId: string,
  messageId: number
) {
  await pool.query(
    `UPDATE app_orders
     SET telegram_chat_id = $1, telegram_message_id = $2,
         telegram_notification_status = 'sent',
         telegram_notification_attempts = telegram_notification_attempts + 1,
         telegram_notification_updated_at = now(),
         telegram_notification_next_retry_at = NULL
     WHERE id = $3`,
    [chatId, messageId, orderId]
  );
}

export async function markTelegramFailed(pool: pg.Pool, orderId: string) {
  await pool.query(
    `UPDATE app_orders
     SET telegram_notification_status = 'failed',
         telegram_notification_attempts = telegram_notification_attempts + 1,
         telegram_notification_updated_at = now(),
         telegram_notification_next_retry_at = now() + make_interval(
           secs => LEAST(3600, (30 * power(2, LEAST(telegram_notification_attempts, 7)))::integer)
         )
     WHERE id = $1`,
    [orderId]
  );
}

export async function claimTelegramDeliveries(pool: pg.Pool, limit = 10) {
  const result = await pool.query<{ id: string }>(
    `WITH due AS (
       SELECT id FROM app_orders
       WHERE telegram_message_id IS NULL
         AND (
           telegram_notification_status IN ('pending', 'failed')
           OR (
             telegram_notification_status = 'sending'
             AND telegram_notification_updated_at < now() - INTERVAL '5 minutes'
           )
         )
         AND (
           telegram_notification_next_retry_at IS NULL
           OR telegram_notification_next_retry_at <= now()
         )
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE app_orders orders
     SET telegram_notification_status = 'sending',
         telegram_notification_updated_at = now()
     FROM due
     WHERE orders.id = due.id
     RETURNING orders.id`,
    [limit]
  );
  return result.rows.map((row) => row.id);
}
