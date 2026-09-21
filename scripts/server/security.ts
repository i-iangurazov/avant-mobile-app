import { createHash } from 'node:crypto';
import type pg from 'pg';

export function fail(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

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
