import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { bootstrapOwner } from '../admin/bootstrap-owner';
import { copyLegacyAccounts } from '../db/copy-legacy-accounts';
import { assertProductionSchema } from '../server/db';
import { hashPassword, loginCustomer, verifyPassword } from '../server/auth';

async function main() {
  const url = process.env.TEST_DATABASE_URL || '';
  assert.equal(url, 'postgresql://audit@127.0.0.1:55448/remediation');
  const base = new pg.Pool({ connectionString: url });
  const suffix = randomUUID().replaceAll('-', '');
  const names = ['source', 'target'].map(name => `deployment_${name}_${suffix}`);
  const pools: pg.Pool[] = [];
  const checks: string[] = [];
  try {
    for (const name of names) {
      await base.query(`CREATE DATABASE "${name}"`);
      const address = new URL(url); address.pathname = '/' + name;
      pools.push(new pg.Pool({ connectionString: address.toString() }));
    }
    const [source, target] = pools;
    const schema = readFileSync('scripts/db/schema.sql', 'utf8');
    const legacy = schema.slice(0, schema.indexOf('-- Account capabilities'));
    await source.query(legacy.slice(0, legacy.indexOf('CREATE INDEX')));
    await target.query(legacy);
    await assert.rejects(() => assertProductionSchema(target), /complete app migration/);
    const migration = readFileSync('scripts/db/migrations/20260921-complete-app-schema.sql', 'utf8');
    const stamp = new Date('2026-09-01T00:00:00Z');
    for (let i = 0; i < 3; i++) await source.query('INSERT INTO app_customers(id,name,phone,password_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5)', ['legacy-' + i, 'Isolated fixture', '+99670011000' + i, hashPassword('legacy-test-password'), stamp]);
    await target.query(migration); await target.query(migration); await assertProductionSchema(target);
    for (const table of ['app_loyalty_config', 'app_loyalty_levels', 'app_account_roles', 'app_order_offers', 'app_public_documents']) assert.equal(Number((await target.query(`SELECT count(*) n FROM ${table}`)).rows[0].n), 0);
    checks.push('legacy migration and repeat are safe; no loyalty, inventory, documents or roles seeded');
    const plan = await copyLegacyAccounts(source, target);
    assert.equal(plan.count, 3); assert.equal(Number((await target.query('SELECT count(*) n FROM app_customers')).rows[0].n), 0);
    await assert.rejects(() => copyLegacyAccounts(source, target, '0'.repeat(64)), /Source changed/);
    await copyLegacyAccounts(source, target, plan.digest);
    const copied = await copyLegacyAccounts(source, target, plan.digest); assert.equal(copied.existing, 3);
    const rows = (await target.query('SELECT * FROM app_customers ORDER BY id')).rows;
    assert.ok(rows.every(row => verifyPassword('legacy-test-password', row.password_hash) && row.created_at.toISOString() === stamp.toISOString() && row.phone_verified_at === null));
    checks.push('dry-run writes nothing; digest mismatch refuses; three IDs/hashes/timestamps preserved; retry does not duplicate');
    const signed = await loginCustomer(target, { phone: rows[0].phone, password: 'legacy-test-password' }, 'isolated-deployment-secret');
    assert.equal(signed.user.isAdmin, false);
    checks.push('migrated customer can sign in and has no admin privilege');
    await target.query("UPDATE app_customers SET name='conflict' WHERE id='legacy-2'");
    await assert.rejects(() => copyLegacyAccounts(source, target, plan.digest), /Conflicting target/);
    await source.query('CREATE TABLE app_new_data(id text)');
    await assert.rejects(() => copyLegacyAccounts(source, target), /Source schema changed/);
    checks.push('conflict and expanded source schema refuse cutover without overwriting data');
    const owner = { accountId: randomUUID(), phone: '+996700220001', name: 'Test owner', password: 'isolated-owner-password-very-long', reason: 'Explicit local test owner bootstrap' };
    await assert.rejects(() => bootstrapOwner(target, { ...owner, phone: rows[0].phone }), /will not take over/);
    const attempts = await Promise.allSettled([bootstrapOwner(target, owner), bootstrapOwner(target, { ...owner, accountId: randomUUID(), phone: '+996700220002' })]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(Number((await target.query("SELECT count(*) n FROM app_account_roles WHERE role='admin'")).rows[0].n), 1);
    assert.equal(Number((await target.query("SELECT count(*) n FROM app_admin_audit_log WHERE action='admin.owner_bootstrap'")).rows[0].n), 1);
    const admin = (await target.query("SELECT c.* FROM app_customers c JOIN app_account_roles r ON r.account_id=c.id WHERE r.role='admin'")).rows[0];
    assert.equal((await loginCustomer(target, { phone: admin.phone, password: owner.password }, 'isolated-deployment-secret')).user.isAdmin, true);
    assert.equal(admin.phone_verified_at, null);
    await assert.rejects(() => bootstrapOwner(target, { ...owner, accountId: randomUUID(), phone: '+996700220003' }), /already exists/);
    checks.push('bootstrap never claims existing phone, serializes concurrent grants, audits exactly one admin; normal sign-in works');
    const result = { status: 'PASS', environment: 'two disposable local PostgreSQL databases; no production mutation', checks };
    writeFileSync('artifacts/device-20260921/deployment-regressions.json', JSON.stringify(result, null, 2)); console.log(result);
  } finally {
    for (const pool of pools) await pool.end();
    for (const name of names) await base.query(`DROP DATABASE IF EXISTS "${name}"`);
    await base.end();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
