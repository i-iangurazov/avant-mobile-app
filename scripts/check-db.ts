import { checkDatabase, createPool, ensureSchema } from "./server/db";
import { loadEnv } from "./server/env";

async function main() {
  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL || "";

  console.log("Database env:");
  console.log(`  DATABASE_URL: ${databaseUrl ? "present" : "missing"}`);

  if (!databaseUrl) {
    console.error("Database check failed: missing DATABASE_URL.");
    process.exit(1);
  }

  const pool = createPool(databaseUrl);
  if (!pool) {
    console.error("Database check failed: could not create Postgres pool.");
    process.exit(1);
  }

  try {
    await ensureSchema(pool);
    const result = await checkDatabase(pool);
    console.log(`  reachable: ${result.reachable ? "yes" : "no"}`);
    console.log(`  app_customers table: ${result.customersTable ? "present" : "missing"}`);
    console.log(`  app_orders table: ${result.ordersTable ? "present" : "missing"}`);
    console.log(`  app_order_items table: ${result.orderItemsTable ? "present" : "missing"}`);
    console.log(`  app_order_status_events table: ${result.statusEventsTable ? "present" : "missing"}`);
    console.log(`  app_plumber_profiles table: ${result.plumbersTable ? "present" : "missing"}`);
    console.log(`  app_loyalty_transactions table: ${result.loyaltyTable ? "present" : "missing"}`);
    console.log(`  app_service_requests table: ${result.serviceRequestsTable ? "present" : "missing"}`);
    console.log(`  app_notification_outbox table: ${result.notificationsTable ? "present" : "missing"}`);

    if (!result.customersTable || !result.ordersTable || !result.orderItemsTable || !result.statusEventsTable || !result.plumbersTable || !result.loyaltyTable || !result.serviceRequestsTable || !result.notificationsTable) {
      console.error("Database check failed: one or more app tables are missing.");
      process.exit(1);
    }

    console.log("Database check passed.");
  } finally {
    await pool.end();
  }
}

const describeError = (error: unknown): string => {
  if (error instanceof AggregateError) {
    return error.errors.map(describeError).filter(Boolean).join("; ") || "connection failed";
  }
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? ` (${error.code})` : "";
    return `${error.message || error.name}${code}`;
  }
  return String(error);
};

void main().catch((error) => {
  console.error("Database check failed:", describeError(error));
  process.exit(1);
});
