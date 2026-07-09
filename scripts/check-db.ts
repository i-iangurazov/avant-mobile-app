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

    if (!result.customersTable) {
      console.error("Database check failed: app_customers table is missing.");
      process.exit(1);
    }

    console.log("Database check passed.");
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("Database check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
