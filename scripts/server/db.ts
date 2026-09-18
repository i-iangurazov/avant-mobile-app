import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  password_hash: string;
  phone_verified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export function createPool(databaseUrl: string) {
  if (!databaseUrl) {
    return null;
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 8,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    idleTimeoutMillis: 30_000
  });
}

export async function ensureSchema(pool: pg.Pool) {
  const schema = readFileSync(resolve(process.cwd(), "scripts/db/schema.sql"), "utf8");
  await pool.query(schema);
}

export async function checkDatabase(pool: pg.Pool) {
  await pool.query("SELECT 1");
  const table = await pool.query(
    `SELECT
       to_regclass('public.app_customers') AS customers_table,
       to_regclass('public.app_orders') AS orders_table,
       to_regclass('public.app_order_items') AS order_items_table,
       to_regclass('public.app_order_status_events') AS status_events_table,
       to_regclass('public.app_plumber_profiles') AS plumbers_table,
       to_regclass('public.app_loyalty_transactions') AS loyalty_table,
       to_regclass('public.app_service_requests') AS service_requests_table,
       to_regclass('public.app_notification_outbox') AS notifications_table`
  );

  return {
    reachable: true,
    customersTable: Boolean(table.rows[0]?.customers_table),
    ordersTable: Boolean(table.rows[0]?.orders_table),
    orderItemsTable: Boolean(table.rows[0]?.order_items_table),
    statusEventsTable: Boolean(table.rows[0]?.status_events_table),
    plumbersTable: Boolean(table.rows[0]?.plumbers_table),
    loyaltyTable: Boolean(table.rows[0]?.loyalty_table),
    serviceRequestsTable: Boolean(table.rows[0]?.service_requests_table),
    notificationsTable: Boolean(table.rows[0]?.notifications_table)
  };
}
