import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { createPool, ensureSchema } from '../server/db';
import { registerFixture, assertTestDatabase } from './fixtures';
import { createAppOrder, claimTelegramDeliveries, markTelegramSent, type NewOrder } from '../server/orders';

const pool = createPool(process.env.TEST_DATABASE_URL || '')!;
assertTestDatabase(pool);
const work = mkdtempSync(join(tmpdir(), 'avantehnik-telegram-test-'));
const base = 'http://127.0.0.1:8792';
const secret = 'isolated-telegram-auth-secret';
const organization = `telegram-${randomUUID()}`;
const foreignOrganization = `telegram-foreign-${randomUUID()}`;
const checks: string[] = [];
let processHandle: ChildProcess | undefined;
let accountId = '';
let adminId = '';
const check = (name: string, result: unknown) => { assert.ok(result, name); checks.push(name); };
const calls = () => readFileSync(join(work, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const mode = (value: string) => writeFileSync(join(work, 'mode'), value);
async function until(fn: () => Promise<boolean>, label: string) {
  for (let i = 0; i < 60; i++) { if (await fn()) return; await wait(100); }
  throw new Error(`Timeout: ${label}`);
}
async function stop() {
  if (!processHandle || processHandle.exitCode !== null) return;
  const ended = new Promise<void>(done => processHandle!.once('exit', () => done()));
  processHandle.kill('SIGTERM'); await ended; processHandle = undefined;
}
async function start() {
  processHandle = spawn(process.execPath, ['--import', resolve('scripts/tests/telegram-network.mjs'), '--import', 'tsx', 'scripts/app-server.ts'], {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: pool.options.connectionString!, PORT: '8792', APP_SERVER_HOST: '127.0.0.1', AUTH_TOKEN_SECRET: secret,
      TELEGRAM_BOT_TOKEN: 'fixture:token', TELEGRAM_CHAT_ID: '-100200', TELEGRAM_BOT_USERNAME: 'fixture_bot', TELEGRAM_WEBHOOK_URL: 'https://telegram-fixture.invalid/telegram/webhook', TELEGRAM_WEBHOOK_SECRET: 'fixture-webhook-secret', TELEGRAM_TEST_DIR: work,
      PRODUCT_CATALOG_SOURCE: 'bazaar', BAZAAR_API_BASE_URL: 'https://catalog.fixture.invalid', BAZAAR_API_TOKEN: 'fixture', APP_ORGANIZATION_ID: organization, DELIVERY_BRANCH_ID: 'branch', RAILWAY_PUBLIC_DOMAIN: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  processHandle.stdout?.on('data', b => appendFileSync(join(work, 'server.log'), b));
  processHandle.stderr?.on('data', b => appendFileSync(join(work, 'server.log'), b));
  await until(async () => { try { await fetch(base + '/health'); return true; } catch { return false; } }, 'test server startup');
}
async function request(path: string, method: string, body?: unknown, token?: string, webhookSecret?: string) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(webhookSecret ? { 'x-telegram-bot-api-secret-token': webhookSecret } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
async function main() {
  try {
    await ensureSchema(pool); mode('pass'); writeFileSync(join(work, 'calls.jsonl'), '');
    const account = await registerFixture(pool, { name: 'Telegram isolated QA', phone: '+996709' + String(Date.now()).slice(-6), password: 'test-password' }, secret);
    accountId = account.user.id;
    const admin = await registerFixture(pool, { name: 'Order admin isolated QA', phone: '+996708' + String(Date.now()).slice(-6), password: 'test-password' }, secret);
    adminId = admin.user.id;
    await pool.query("INSERT INTO app_account_roles(account_id,role) VALUES($1,'admin')", [adminId]);
    const adminToken = admin.session.accessToken;
    for (const org of [organization, foreignOrganization]) {
      await pool.query("INSERT INTO app_order_branches(organization_id,id,name,address,is_active,orders_enabled) VALUES($1,'branch','QA branch','QA address',true,true)", [org]);
      await pool.query("INSERT INTO app_order_offers(organization_id,branch_id,product_id,product_name,unit_price_minor,stock_quantity,is_active,valid_until) VALUES($1,'branch','tg-sku','Telegram QA <product>',1234,100,true,now()+interval '1 hour')", [org]);
    }
    await start();
    check('health requires successful webhook registration', (await request('/health', 'GET')).body.telegramWebhook === 'registered');
    const body: NewOrder = { clientRequestId: randomUUID(), customerName: 'Telegram QA', customerPhone: account.user.phone, deliveryMethod: 'pickup', storeId: 'branch', storeName: null, storeAddress: null, deliveryAddress: null, comment: null, items: [{ productId: 'tg-sku', productName: 'client name ignored', quantity: 1, unitPrice: 12.34, unitPriceLabel: null }] };
    const created = await request('/orders', 'POST', body, account.session.accessToken);
    check('HTTP creates order before Telegram transport completes', created.status === 201);
    const id = created.body.data.id;
    for (const path of ['/admin/orders', `/admin/orders/${id}`]) {
      check(`guest denied ${path.replace(id, ':id')}`, (await request(path, 'GET')).status === 401);
      check(`customer denied ${path.replace(id, ':id')}`, (await request(path, 'GET', undefined, account.session.accessToken)).status === 403);
    }
    const adminDetail = await request(`/admin/orders/${id}`, 'GET', undefined, adminToken);
    check('admin sees same saved order, trusted total and customer contact', adminDetail.status === 200 && adminDetail.body.data.id === id && Number(adminDetail.body.data.total_amount) === 12.34 && adminDetail.body.data.customer_phone === account.user.phone);
    check('admin response does not expose Telegram message routing', !('telegram' in adminDetail.body.data));
    check('admin unknown order is404', (await request(`/admin/orders/${randomUUID()}`, 'GET', undefined, adminToken)).status === 404);
    for (const query of ['limit=0','limit=-1','limit=1.5','limit=101','cursor=not-an-id']) check(`invalid admin pagination ${query}`, (await request('/admin/orders?' + query, 'GET', undefined, adminToken)).status === 400);
    const row = async (orderId = id) => (await pool.query('SELECT * FROM app_orders WHERE id=$1', [orderId])).rows[0];
    await until(async () => (await row()).telegram_notification_status === 'sent', 'immediate delivery, before30-second timer');
    const delivered = await row();
    const message = calls().find(c => c.method === 'sendMessage' && c.payload.text.includes(delivered.order_number));
    check('delivery immediately wakes durable queue and persists message ID', delivered.telegram_message_id && delivered.telegram_chat_id === '-100200');
    check('message contains trusted escaped product and initial status buttons', message.payload.text.includes('Telegram QA &lt;product&gt;') && message.payload.reply_markup.inline_keyboard.length === 2);
    await Promise.all(Array.from({ length: 20 }, () => request('/orders', 'POST', body, account.session.accessToken)));
    check('20 order retries produce one order and one successful notification', Number((await pool.query('SELECT count(*) FROM app_orders WHERE customer_id=$1 AND client_request_id=$2', [accountId, body.clientRequestId])).rows[0].count) === 1 && calls().filter(c => c.method === 'sendMessage' && c.payload.text.includes(delivered.order_number)).length === 1);
    const callback = async (status: string, changes: Record<string, unknown> = {}, header = 'fixture-webhook-secret') => request('/telegram/webhook', 'POST', { update_id: 1, callback_query: { id: 'fixture-callback', from: { id: 101 }, message: { message_id: Number(delivered.telegram_message_id), chat: { id: -100200 } }, data: `o:${id}:${status}`, ...changes } }, undefined, header);
    check('invalid webhook secret denied', (await callback('confirmed', {}, 'wrong-secret')).status === 401);
    await callback('confirmed', { from: { id: 202 } }); check('ordinary Telegram group member cannot change order', (await row()).status === 'created');
    await callback('confirmed', { message: { message_id: Number(delivered.telegram_message_id), chat: { id: -100201 } } }); check('foreign chat cannot change order', (await row()).status === 'created');
    await callback('confirmed', { message: { message_id: 999999, chat: { id: -100200 } } }); check('wrong message cannot change order', (await row()).status === 'created');
    await callback('hacked'); check('invalid status button rejected', (await row()).status === 'created');
    check('verified chat administrator can confirm', (await callback('confirmed')).status === 200 && (await row()).status === 'confirmed');
    check('admin order API sees Telegram status', (await request(`/admin/orders/${id}`, 'GET', undefined, adminToken)).body.data.status === 'confirmed');
    check('mobile order API sees Telegram status', (await request(`/orders/${id}`, 'GET', undefined, account.session.accessToken)).body.data.status === 'confirmed');
    const repeated = await Promise.all(Array.from({ length: 20 }, () => callback('confirmed')));
    check('20 repeated callbacks acknowledge unchanged Telegram edits without500', repeated.every(r => r.status === 200));
    check('repeated callback adds no audit events', Number((await pool.query('SELECT count(*) FROM app_order_status_events WHERE order_id=$1', [id])).rows[0].count) === 2);
    await callback('completed'); check('invalid forward transition rejected', (await row()).status === 'confirmed');
    for (const status of ['assembling', 'ready_for_pickup', 'completed']) check(`Telegram transition ${status}`, (await callback(status)).status === 200 && (await row()).status === status);
    check('completion consumes inventory once', (await pool.query("SELECT stock_quantity,reserved_quantity FROM app_order_offers WHERE organization_id=$1 AND product_id='tg-sku'", [organization])).rows[0].stock_quantity === 99 && !(await row()).inventory_held);
    const foreign = await createAppOrder(pool, accountId, { ...body, clientRequestId: randomUUID() }, { organizationId: foreignOrganization });
    check('worker never claims another organization', !(await claimTelegramDeliveries(pool, organization)).includes(foreign.order!.id) && (await row(foreign.order!.id)).telegram_notification_status === 'pending');
    check('admin cannot read foreign organization', (await request(`/admin/orders/${foreign.order!.id}`, 'GET', undefined, adminToken)).status === 404);
    const scoped = await request('/admin/orders?organizationId=' + foreignOrganization, 'GET', undefined, adminToken);
    check('client organization cannot switch admin list context', scoped.status === 200 && scoped.body.data.every((r: {id:string}) => r.id !== foreign.order!.id));
    check('foreign organization cursor cannot enumerate orders', (await request('/admin/orders?cursor=' + foreign.order!.id, 'GET', undefined, adminToken)).body.data.length === 0);
    await markTelegramSent(pool, foreign.order!.id, '-100200', Number(delivered.telegram_message_id));
    await callback('confirmed', { data: `o:${foreign.order!.id}:confirmed` }); check('callback cannot switch organization even in same chat', (await row(foreign.order!.id)).status === 'created');
    const retryBody = { ...body, clientRequestId: randomUUID() };
    mode('send-failure'); const failed = await request('/orders', 'POST', retryBody, account.session.accessToken); const failedId = failed.body.data.id;
    await until(async () => (await row(failedId)).telegram_notification_status === 'failed', 'transport failure recorded');
    check('transport failure keeps accepted order and schedules retry', failed.status === 201 && (await row(failedId)).telegram_notification_next_retry_at);
    mode('pass'); await pool.query('UPDATE app_orders SET telegram_notification_next_retry_at=now() WHERE id=$1', [failedId]);
    await request('/orders', 'POST', retryBody, account.session.accessToken);
    await until(async () => (await row(failedId)).telegram_notification_status === 'sent', 'retry delivery');
    check('retry delivers existing order after transport recovers', Number((await row(failedId)).telegram_notification_attempts) === 2);
    const firstPage = (await request('/admin/orders?limit=1', 'GET', undefined, adminToken)).body;
    const secondPage = (await request('/admin/orders?limit=1&cursor=' + firstPage.nextCursor, 'GET', undefined, adminToken)).body;
    check('admin keyset pagination includes all own orders without duplicates', firstPage.data.length === 1 && secondPage.data.length === 1 && !secondPage.nextCursor && new Set([firstPage.data[0].id, secondPage.data[0].id]).size === 2 && [firstPage.data[0].id, secondPage.data[0].id].every(value => [id, failedId].includes(value)));
    check('admin list exposes notification delivery status', firstPage.data[0].telegram_notification_status === 'sent');
    await pool.query("UPDATE app_account_roles SET is_active=false WHERE account_id=$1", [adminId]);
    check('revoked admin token cannot list orders', (await request('/admin/orders', 'GET', undefined, adminToken)).status === 403);
    check('revoked admin token cannot read order', (await request(`/admin/orders/${id}`, 'GET', undefined, adminToken)).status === 403);
    await stop(); mode('webhook-failure'); await start();
    const health = await request('/health', 'GET'); check('failed webhook registration cannot report healthy', health.status === 503 && health.body.telegramWebhook === 'registration_failed');
    const evidence = { status: 'PASS', transport: 'ISOLATED ADAPTER; no real Telegram messages or webhook changes', checks, appServerSha256: createHash('sha256').update(readFileSync('scripts/app-server.ts')).digest('hex') };
    const output = process.env.TELEGRAM_TEST_EVIDENCE || 'artifacts/device-20260921/telegram-orders.json'; writeFileSync(output, JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await stop();
    if (accountId) await pool.query('DELETE FROM app_orders WHERE customer_id=$1', [accountId]);
    await pool.query('DELETE FROM app_order_offers WHERE organization_id=ANY($1)', [[organization, foreignOrganization]]);
    await pool.query('DELETE FROM app_order_branches WHERE organization_id=ANY($1)', [[organization, foreignOrganization]]);
    if (accountId) await pool.query('DELETE FROM app_customers WHERE id=$1', [accountId]);
    if (adminId) await pool.query('DELETE FROM app_customers WHERE id=$1', [adminId]);
    await pool.end(); rmSync(work, { recursive: true, force: true });
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
