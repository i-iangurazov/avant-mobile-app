import { createHash, randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";

type Queryable = pg.Pool | pg.PoolClient;

export type NotificationInput = {
  recipientAccountId?: string | null;
  targetChatId?: string | null;
  eventType: string;
  dedupeKey: string;
  text: string;
};

const notificationCategory = (eventType: string) => {
  if (eventType.startsWith("plumber.application")) return "applications";
  if (eventType.startsWith("lead.")) return "leads";
  if (eventType.startsWith("reservation.")) return "reservations";
  if (eventType.startsWith("promotion.") || eventType.startsWith("training.")) return "content";
  return "loyalty";
};

export async function enqueueNotification(database: Queryable, input: NotificationInput) {
  const text = input.text.trim().slice(0, 3_500);
  if (!text || !input.eventType || !input.dedupeKey || (!input.recipientAccountId && !input.targetChatId)) {
    throw new Error("Invalid notification payload.");
  }
  const result = await database.query<{ id: string }>(
    `INSERT INTO app_notification_outbox (
       id, recipient_account_id, target_chat_id, event_type, dedupe_key, safe_payload
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      input.recipientAccountId ?? null,
      input.targetChatId ?? null,
      input.eventType.slice(0, 100),
      input.dedupeKey.slice(0, 250),
      JSON.stringify({ text })
    ]
  );
  return { created: Boolean(result.rows[0]), id: result.rows[0]?.id ?? null };
}

export async function createTelegramLinkToken(pool: pg.Pool, accountId: string, botUsername?: string) {
  const rawToken = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE app_telegram_link_tokens SET used_at = now() WHERE account_id = $1 AND used_at IS NULL",
      [accountId]
    );
    await client.query(
      `INSERT INTO app_telegram_link_tokens (id, account_id, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + INTERVAL '10 minutes')`,
      [randomUUID(), accountId, tokenHash]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const username = botUsername?.replace(/^@/, "").trim();
  return {
    expiresInSeconds: 600,
    command: `/start link_${rawToken}`,
    url: username ? `https://t.me/${encodeURIComponent(username)}?start=link_${rawToken}` : null
  };
}

export async function consumeTelegramLinkToken(
  pool: pg.Pool,
  rawToken: string,
  telegramUserId: number,
  telegramChatId: number,
  username?: string | null
) {
  if (!Number.isSafeInteger(telegramUserId) || !Number.isSafeInteger(telegramChatId) || telegramUserId !== telegramChatId) {
    throw Object.assign(new Error("Привязку аккаунта нужно открыть в личном чате с ботом."), { statusCode: 400 });
  }
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const token = await client.query<{ id: string; account_id: string }>(
      `SELECT id, account_id FROM app_telegram_link_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [tokenHash]
    );
    if (!token.rows[0]) {
      throw Object.assign(new Error("Ссылка устарела. Создайте новую ссылку в приложении."), { statusCode: 410 });
    }
    const conflict = await client.query<{ account_id: string }>(
      "SELECT account_id FROM app_telegram_links WHERE telegram_user_id = $1 AND account_id <> $2 LIMIT 1",
      [telegramUserId, token.rows[0].account_id]
    );
    if (conflict.rows[0]) {
      throw Object.assign(new Error("Этот Telegram уже связан с другим аккаунтом."), { statusCode: 409 });
    }
    await client.query(
      `INSERT INTO app_telegram_links (
         account_id, telegram_user_id, telegram_chat_id, telegram_username,
         notifications_enabled, linked_at, updated_at
       ) VALUES ($1, $2, $3, $4, true, now(), now())
       ON CONFLICT (account_id) DO UPDATE SET
         telegram_user_id = EXCLUDED.telegram_user_id,
         telegram_chat_id = EXCLUDED.telegram_chat_id,
         telegram_username = EXCLUDED.telegram_username,
         notifications_enabled = true,
         linked_at = now(), updated_at = now()`,
      [token.rows[0].account_id, telegramUserId, telegramChatId, username?.slice(0, 100) || null]
    );
    await client.query("UPDATE app_telegram_link_tokens SET used_at = now() WHERE id = $1", [token.rows[0].id]);
    await client.query("COMMIT");
    return { accountId: token.rows[0].account_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getTelegramLinkStatus(pool: pg.Pool, accountId: string) {
  const result = await pool.query<{
    telegram_username: string | null;
    notifications_enabled: boolean;
    linked_at: Date | string;
    preferences: unknown;
  }>(
    `SELECT telegram_username, notifications_enabled, linked_at, preferences
     FROM app_telegram_links WHERE account_id = $1 LIMIT 1`,
    [accountId]
  );
  const row = result.rows[0];
  return row ? {
    connected: true,
    username: row.telegram_username,
    notificationsEnabled: row.notifications_enabled,
    linkedAt: new Date(row.linked_at).toISOString(),
    preferences: row.preferences && typeof row.preferences === "object" ? row.preferences : {}
  } : {
    connected: false,
    username: null,
    notificationsEnabled: false,
    linkedAt: null,
    preferences: {}
  };
}

export async function updateTelegramPreferences(
  pool: pg.Pool,
  accountId: string,
  notificationsEnabled: boolean,
  preferences: Record<string, boolean>
) {
  const allowedKeys = ["applications", "loyalty", "leads", "reservations", "content"];
  const safePreferences = Object.fromEntries(
    allowedKeys.filter((key) => typeof preferences[key] === "boolean").map((key) => [key, preferences[key]])
  );
  const result = await pool.query(
    `UPDATE app_telegram_links
     SET notifications_enabled = $1, preferences = $2::jsonb, updated_at = now()
     WHERE account_id = $3`,
    [notificationsEnabled, JSON.stringify(safePreferences), accountId]
  );
  if (!result.rowCount) throw Object.assign(new Error("Сначала подключите Telegram."), { statusCode: 404 });
  return getTelegramLinkStatus(pool, accountId);
}

type ClaimedNotification = {
  id: string;
  recipient_account_id: string | null;
  target_chat_id: string | null;
  event_type: string;
  safe_payload: { text?: unknown };
};

export async function deliverNotificationOutbox(
  pool: pg.Pool,
  sender: (chatId: string, text: string) => Promise<{ message_id: number }>,
  limit = 20
) {
  const claimed = await pool.query<ClaimedNotification>(
    `WITH due AS (
       SELECT id FROM app_notification_outbox
       WHERE status IN ('pending', 'failed')
         AND (next_retry_at IS NULL OR next_retry_at <= now())
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE app_notification_outbox notifications
     SET status = 'sending', updated_at = now()
     FROM due WHERE notifications.id = due.id
     RETURNING notifications.id, notifications.recipient_account_id,
               notifications.target_chat_id, notifications.event_type,
               notifications.safe_payload`,
    [limit]
  );

  for (const notification of claimed.rows) {
    let chatId = notification.target_chat_id;
    if (!chatId && notification.recipient_account_id) {
      const link = await pool.query<{
        telegram_chat_id: string | number;
        notifications_enabled: boolean;
        preferences: Record<string, unknown> | null;
      }>(
        `SELECT telegram_chat_id, notifications_enabled, preferences
         FROM app_telegram_links WHERE account_id = $1 LIMIT 1`,
        [notification.recipient_account_id]
      );
      const linked = link.rows[0];
      const category = notificationCategory(notification.event_type);
      if (!linked) {
        await pool.query(
          `UPDATE app_notification_outbox
           SET status = 'pending', next_retry_at = now() + INTERVAL '1 hour', updated_at = now()
           WHERE id = $1`,
          [notification.id]
        );
        continue;
      }
      if (!linked.notifications_enabled || linked.preferences?.[category] === false) {
        await pool.query(
          "UPDATE app_notification_outbox SET status = 'cancelled', updated_at = now() WHERE id = $1",
          [notification.id]
        );
        continue;
      }
      chatId = String(linked.telegram_chat_id);
    }

    const text = typeof notification.safe_payload?.text === "string"
      ? notification.safe_payload.text.slice(0, 3_500)
      : "У вас новое уведомление от Авантехник.";
    try {
      const message = await sender(String(chatId), text);
      await pool.query(
        `UPDATE app_notification_outbox
         SET status = 'sent', attempts = attempts + 1, telegram_message_id = $1,
             last_error = NULL, next_retry_at = NULL, sent_at = now(), updated_at = now()
         WHERE id = $2`,
        [message.message_id, notification.id]
      );
    } catch (error) {
      const safeError = error instanceof Error ? error.message.slice(0, 300) : "Telegram delivery failed";
      await pool.query(
        `UPDATE app_notification_outbox
         SET status = 'failed', attempts = attempts + 1, last_error = $1,
             next_retry_at = now() + make_interval(
               secs => LEAST(21600, (30 * power(2, LEAST(attempts, 9)))::integer)
             ), updated_at = now()
         WHERE id = $2`,
        [safeError, notification.id]
      );
    }
  }
  return claimed.rowCount ?? 0;
}

export async function getNotificationMetrics(pool: pg.Pool) {
  const result = await pool.query<{ status: string; count: string | number }>(
    "SELECT status, COUNT(*) AS count FROM app_notification_outbox GROUP BY status ORDER BY status"
  );
  return Object.fromEntries(result.rows.map((row) => [row.status, Number(row.count)]));
}
