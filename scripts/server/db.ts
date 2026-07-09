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
    "SELECT to_regclass('public.app_customers') AS table_name"
  );

  return {
    reachable: true,
    customersTable: Boolean(table.rows[0]?.table_name)
  };
}
