import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type pg from 'pg';
import { createPool } from '../server/db';
import { hashPassword, isValidAccountPhone, normalizePhone } from '../server/auth';

// Operator-only CLI. Never imported by the HTTP server or triggered by registration.
export async function bootstrapOwner(pool: pg.Pool, input: {
  accountId: string; phone: string; name: string; password: string; reason: string;
}) {
  const phone = normalizePhone(input.phone);
  if (!isValidAccountPhone(phone) || !input.name.trim() || input.reason.trim().length < 10 || input.password.length < 24) {
    throw new Error('Explicit owner identity, strong generated password, and audit reason required.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    // Serialize against registration and grants, including simultaneous bootstrap calls.
    await client.query('LOCK TABLE app_customers, app_account_roles IN SHARE ROW EXCLUSIVE MODE');
    if ((await client.query("SELECT 1 FROM app_account_roles WHERE role='admin' AND is_active LIMIT 1")).rowCount) {
      throw new Error('An administrator already exists; use the audited role-grant procedure.');
    }
    if ((await client.query('SELECT 1 FROM app_customers WHERE phone=$1', [phone])).rowCount) {
      throw new Error('Phone already belongs to an account; bootstrap will not take over that account.');
    }
    await client.query('INSERT INTO app_customers(id,name,phone,password_hash) VALUES($1,$2,$3,$4)',
      [input.accountId, input.name.trim(), phone, hashPassword(input.password)]);
    await client.query("INSERT INTO app_account_roles(account_id,role) VALUES($1,'customer'),($1,'admin')", [input.accountId]);
    await client.query(`INSERT INTO app_admin_audit_log(id,actor_id,action,entity_type,entity_id,reason,metadata)
      VALUES($1,$2,'admin.owner_bootstrap','customer',$2,$3,'{"source":"explicit-operator-cli"}'::jsonb)`,
    [randomUUID(), input.accountId, input.reason.trim()]);
    await client.query('COMMIT');
    return input.accountId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function main() {
  const [phone, name, expectedDatabase, reason, credentialFile, ...rest] = process.argv.slice(2);
  const url = process.env.DATABASE_URL || '';
  if (!url || !phone || !name || !expectedDatabase || !reason || !credentialFile || rest.length) {
    throw new Error('Usage: DATABASE_URL=… tsx scripts/admin/bootstrap-owner.ts PHONE NAME EXPECTED_DATABASE AUDIT_REASON NEW_PRIVATE_CREDENTIAL_FILE');
  }
  if (decodeURIComponent(new URL(url).pathname.slice(1)) !== expectedDatabase) throw new Error('Wrong target database.');
  const input = { accountId: randomUUID(), phone, name, password: randomBytes(24).toString('base64url'), reason };
  // Persist before COMMIT: even an ambiguous network failure cannot lose the password.
  // wx rejects pre-existing files and symlinks; output never contains the password.
  writeFileSync(credentialFile, JSON.stringify({ accountId: input.accountId, phone: normalizePhone(phone), password: input.password }, null, 2), { flag: 'wx', mode: 0o600 });
  const pool = createPool(url)!;
  try {
    await bootstrapOwner(pool, input);
    console.log('Owner created with an audited database role. Credentials are in the specified private file.');
  } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch(error => { console.error(error instanceof Error ? error.message : 'Bootstrap failed'); process.exitCode = 1; });
}
