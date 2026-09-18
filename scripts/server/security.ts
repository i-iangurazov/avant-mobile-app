import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';

export const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
export type PhoneAction = 'register' | 'login' | 'phone_change' | 'password_reset' | 'delete';
export type PhoneProof = { challengeId?: string; code?: string };
export type SmsSender = (message: { phone: string; code: string; action: PhoneAction; challengeId: string; expiresInSeconds: number }) => Promise<void>;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const codeHash = (id: string, code: string, secret: string) => createHmac('sha256', secret).update(`${id}:${code}`).digest('hex');

// Shared database limits survive process restarts and replicas. Never trust caller supplied forwarding headers.
export async function rateLimit(pool: pg.Pool, scope: string, identity: string, limit: number, windowMs: number) {
  const key = digest(`${scope}:${identity}`);
  const result = await pool.query<{ attempts: number }>(
    `INSERT INTO app_rate_limits (key, attempts, expires_at) VALUES ($1, 1, now() + $2 * interval '1 millisecond')
     ON CONFLICT (key) DO UPDATE SET
       attempts = CASE WHEN app_rate_limits.expires_at <= now() THEN 1 ELSE app_rate_limits.attempts + 1 END,
       expires_at = CASE WHEN app_rate_limits.expires_at <= now() THEN EXCLUDED.expires_at ELSE app_rate_limits.expires_at END
     RETURNING attempts`, [key, windowMs]);
  if (result.rows[0].attempts > limit) fail('Слишком много попыток. Попробуйте позже.', 429);
}

export function httpSmsSender(endpoint: string, token: string): SmsSender {
  return async (message) => {
    if (!endpoint || !token || new URL(endpoint).protocol !== 'https:') fail('Подтверждение номера временно недоступно. Обратитесь в поддержку.', 503);
    const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': message.challengeId },
      body: JSON.stringify(message) });
    if (!response.ok) fail('Не удалось отправить код. Попробуйте позже.', 503);
  };
}

export async function createPhoneChallenge(pool: pg.Pool, secret: string, send: SmsSender,
  action: PhoneAction, phone: string, accountId: string | null) {
  if (!/^\+996\d{9}$/.test(phone)) fail('Введите номер +996 XXX XXX XXX.');
  await rateLimit(pool, 'phone-code', phone, 5, 60 * 60_000);
  const id = randomUUID(); const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await pool.query(`INSERT INTO app_phone_challenges (id, account_id, phone, action, code_hash, expires_at)
    VALUES ($1,$2,$3,$4,$5,now() + interval '5 minutes')`, [id, accountId, phone, action, codeHash(id, code, secret)]);
  try { await send({ phone, code, action, challengeId: id, expiresInSeconds: 300 }); }
  catch (error) { await pool.query('DELETE FROM app_phone_challenges WHERE id=$1', [id]); throw error; }
  return { challengeId: id, expiresInSeconds: 300 };
}

// Own transaction: failed attempts remain counted even if the business operation rolls back.
export async function consumePhoneProof(pool: pg.Pool, secret: string, action: PhoneAction,
  phone: string, accountId: string | null, proof: PhoneProof = {}) {
  const client = await pool.connect(); let valid = false;
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT * FROM app_phone_challenges WHERE id=$1 FOR UPDATE`, [proof.challengeId || '']);
    const row = result.rows[0];
    if (row && !row.consumed_at && new Date(row.expires_at).getTime() > Date.now() && row.attempts < 5) {
      const actual = codeHash(row.id, typeof proof.code === 'string' ? proof.code : '', secret);
      valid = row.action === action && row.phone === phone && row.account_id === accountId &&
        timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(actual));
      await client.query(`UPDATE app_phone_challenges SET attempts=attempts+1,
        consumed_at=CASE WHEN $2 THEN now() ELSE consumed_at END WHERE id=$1`, [row.id, valid]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  if (!valid) fail('Код неверен, истёк или уже использован. Запросите новый код.', 400);
}
