import { readFileSync } from 'node:fs';
import { createPool } from '../server/db';

// An explicit, reviewed branch manifest is required; this never seeds inventory.
async function main() {
  const [manifest, action, ...rest] = process.argv.slice(2);
  if (!manifest || rest.length || (action && action !== '--apply')) throw new Error('Usage: DATABASE_URL=… APP_ORGANIZATION_ID=… tsx scripts/db/configure-inquiry-branches.ts REVIEWED_JSON [--apply]');
  const org = process.env.APP_ORGANIZATION_ID;
  if (!org) throw new Error('APP_ORGANIZATION_ID required');
  const rows: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
  if (!Array.isArray(rows) || !rows.length || rows.length > 100 || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Invalid branch manifest');
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.id) || typeof row.name !== 'string' || !row.name.trim() || typeof row.address !== 'string' || !row.address.trim() || typeof row.deliveryEnabled !== 'boolean') throw new Error('Branch ID, name, address and explicit delivery flag required');
  }
  if (!action) { console.log(JSON.stringify({ mode: 'manifest review only', organization: org, branches: rows }, null, 2)); return; }
  const pool = createPool(process.env.DATABASE_URL || ''); if (!pool) throw new Error('DATABASE_URL required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const existing = await client.query('SELECT 1 FROM app_order_branches WHERE organization_id=$1 AND id=$2', [org, row.id]);
      if (existing.rowCount) throw new Error('Existing branch requires explicit review; will not overwrite it.');
      await client.query(`INSERT INTO app_order_branches(organization_id,id,name,address,is_active,orders_enabled,delivery_enabled)
        VALUES($1,$2,$3,$4,true,true,$5)`, [org,row.id,row.name,row.address,row.deliveryEnabled]);
    }
    await client.query('COMMIT'); console.log('Reviewed branches configured; no inventory or catalogue data changed.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Branch setup failed'); process.exitCode = 1; });
