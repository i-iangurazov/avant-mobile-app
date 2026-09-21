import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type pg from 'pg';
import { createPool } from '../server/db';

const columns = ['id', 'name', 'phone', 'address', 'password_hash', 'created_at', 'updated_at'];
// The inspected legacy Railway database has only app_customers. Refuse broader
// installations: orders/ledgers require a separate, reviewed migration.
export async function copyLegacyAccounts(source: pg.Pool, target: pg.Pool, expectedDigest?: string) {
  const from = await source.connect(), to = await target.connect();
  try {
    await from.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables = (await from.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND left(tablename,4)='app_' ORDER BY tablename")).rows.map(row => row.tablename);
    if (JSON.stringify(tables) !== JSON.stringify(['app_customers'])) throw new Error('Source schema changed: review all data before cutover.');
    const actual = (await from.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='app_customers' ORDER BY ordinal_position")).rows.map(row => row.column_name);
    if (JSON.stringify(actual) !== JSON.stringify(columns)) throw new Error('Source customer columns changed.');
    const rows = (await from.query(`SELECT ${columns.join(',')} FROM app_customers ORDER BY id`)).rows;
    const digest = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    if (expectedDigest && expectedDigest !== digest) throw new Error('Source changed after preflight; stop cutover and review again.');
    await to.query(expectedDigest ? 'BEGIN' : 'BEGIN READ ONLY');
    if (expectedDigest) {
      await to.query("SET LOCAL lock_timeout = '5s'");
      await to.query('LOCK TABLE app_customers IN SHARE ROW EXCLUSIVE MODE');
    }
    let existing = 0;
    for (const row of rows) {
      const found = (await to.query(`SELECT ${columns.join(',')} FROM app_customers WHERE id=$1 OR phone=$2`, [row.id, row.phone])).rows;
      if (found.length) {
        if (found.length !== 1 || JSON.stringify(found[0]) !== JSON.stringify(row)) throw new Error('Conflicting target account; no records were overwritten.');
        existing++;
      } else if (expectedDigest) {
        await to.query(`INSERT INTO app_customers(${columns.join(',')}) VALUES(${columns.map((_, i) => '$' + (i + 1)).join(',')})`, columns.map(key => row[key]));
      }
    }
    await to.query(expectedDigest ? 'COMMIT' : 'ROLLBACK');
    await from.query('ROLLBACK');
    return { mode: expectedDigest ? 'applied' : 'read-only preflight', count: rows.length, existing, digest };
  } catch (error) {
    await to.query('ROLLBACK'); await from.query('ROLLBACK'); throw error;
  } finally { from.release(); to.release(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--apply' && /^[a-f0-9]{64}$/.test(args[1]))) throw new Error('Usage: SOURCE_DATABASE_URL=… TARGET_DATABASE_URL=… tsx scripts/db/copy-legacy-accounts.ts [--apply PREFLIGHT_DIGEST]');
  const source = createPool(process.env.SOURCE_DATABASE_URL || ''), target = createPool(process.env.TARGET_DATABASE_URL || '');
  if (!source || !target) throw new Error('Explicit source and target database URLs are required.');
  try { console.log(JSON.stringify(await copyLegacyAccounts(source, target, args[1]), null, 2)); }
  finally { await source.end(); await target.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch(error => { console.error(error instanceof Error ? error.message : 'Copy failed'); process.exitCode = 1; });
}
