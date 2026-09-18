import { randomUUID } from "node:crypto";
import type pg from "pg";
import { enqueueNotification, getNotificationMetrics } from "./notifications";
import { requireApprovedPlumber } from "./plumbers";

const httpsUrlOrNull = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") throw new Error();
    return url.toString().slice(0, 1_000);
  } catch {
    throw Object.assign(new Error("Изображение должно использовать HTTPS-ссылку."), { statusCode: 400 });
  }
};

const required = (value: unknown, label: string, max = 1_000) => {
  const text = typeof value === "string" ? value.trim().slice(0, max) : "";
  if (!text) throw Object.assign(new Error(`Заполните поле «${label}».`), { statusCode: 400 });
  return text;
};

const dateOrNull = (value: unknown, label: string) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error(`Проверьте поле «${label}».`), { statusCode: 400 });
  return date;
};

export async function listProgramContent(pool: pg.Pool, accountId: string) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  const result = await pool.query<{
    id: string; content_type: string; title: string; description: string; image_url: string | null;
    starts_at: Date | string | null; ends_at: Date | string | null; location: string | null;
    capacity: number | null; registration_status: string | null;
  }>(
    `SELECT content.id, content.content_type, content.title, content.description, content.image_url,
            content.starts_at, content.ends_at, content.location, content.capacity,
            registrations.status AS registration_status
     FROM app_program_content content
     LEFT JOIN app_training_registrations registrations
       ON registrations.content_id = content.id AND registrations.plumber_id = $1
     WHERE content.is_active = true
       AND (content.ends_at IS NULL OR content.ends_at >= now())
     ORDER BY content.starts_at ASC NULLS LAST, content.created_at DESC`,
    [plumber.id]
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.content_type,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    location: row.location,
    capacity: row.capacity,
    registrationStatus: row.registration_status
  }));
}

export async function registerForTraining(pool: pg.Pool, accountId: string, contentId: string) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const content = await client.query<{ title: string; content_type: string; capacity: number | null; is_active: boolean }>(
      "SELECT title, content_type, capacity, is_active FROM app_program_content WHERE id = $1 FOR UPDATE",
      [contentId]
    );
    const item = content.rows[0];
    if (!item || !item.is_active || !["training", "master_day"].includes(item.content_type)) {
      throw Object.assign(new Error("Регистрация на это событие недоступна."), { statusCode: 409 });
    }
    const existing = await client.query<{ id: string; status: string }>(
      "SELECT id, status FROM app_training_registrations WHERE content_id = $1 AND plumber_id = $2 FOR UPDATE",
      [contentId, plumber.id]
    );
    if (existing.rows[0]?.status === "registered") {
      await client.query("COMMIT");
      return { created: false, id: existing.rows[0].id, status: "registered" };
    }
    if (item.capacity !== null) {
      const count = await client.query<{ count: string | number }>(
        "SELECT COUNT(*) AS count FROM app_training_registrations WHERE content_id = $1 AND status = 'registered'",
        [contentId]
      );
      if (Number(count.rows[0]?.count ?? 0) >= item.capacity) {
        throw Object.assign(new Error("Свободных мест больше нет."), { statusCode: 409 });
      }
    }
    const id = existing.rows[0]?.id ?? randomUUID();
    await client.query(
      `INSERT INTO app_training_registrations (id, content_id, plumber_id, status)
       VALUES ($1, $2, $3, 'registered')
       ON CONFLICT (content_id, plumber_id)
       DO UPDATE SET status = 'registered', updated_at = now()`,
      [id, contentId, plumber.id]
    );
    await enqueueNotification(client, {
      recipientAccountId: accountId,
      eventType: "training.registered",
      dedupeKey: `training:${contentId}:${plumber.id}:registered`,
      text: `Вы зарегистрированы на событие «${item.title}». Подробности доступны в приложении.`
    });
    await client.query("COMMIT");
    return { created: !existing.rows[0], id, status: "registered" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertProgramContent(
  pool: pg.Pool,
  actorId: string,
  input: Record<string, unknown>
) {
  const id = typeof input.id === "string" && input.id ? input.id : randomUUID();
  const type = typeof input.type === "string" ? input.type : "";
  if (!["promotion", "new_product", "training", "master_day", "material"].includes(type)) {
    throw Object.assign(new Error("Выберите тип материала."), { statusCode: 400 });
  }
  const title = required(input.title, "Название", 200);
  const description = required(input.description, "Описание", 2_000);
  const startsAt = dateOrNull(input.startsAt, "Начало");
  const endsAt = dateOrNull(input.endsAt, "Окончание");
  if (startsAt && endsAt && endsAt <= startsAt) throw Object.assign(new Error("Дата окончания должна быть позже начала."), { statusCode: 400 });
  const capacity = input.capacity === null || input.capacity === undefined || input.capacity === ""
    ? null
    : Math.floor(Number(input.capacity));
  if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity <= 0)) throw Object.assign(new Error("Проверьте количество мест."), { statusCode: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO app_program_content (
         id, content_type, title, description, image_url, starts_at, ends_at,
         location, capacity, is_active, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         content_type = EXCLUDED.content_type, title = EXCLUDED.title,
         description = EXCLUDED.description, image_url = EXCLUDED.image_url,
         starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
         location = EXCLUDED.location, capacity = EXCLUDED.capacity,
         is_active = EXCLUDED.is_active, updated_at = now()`,
      [
        id, type, title, description, httpsUrlOrNull(input.imageUrl),
        startsAt?.toISOString() ?? null, endsAt?.toISOString() ?? null,
        typeof input.location === "string" ? input.location.trim().slice(0, 300) || null : null,
        capacity, input.isActive !== false, actorId
      ]
    );
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'content.upserted', 'program_content', $3, $4::jsonb)`,
      [randomUUID(), actorId, id, JSON.stringify({ type, title })]
    );
    await client.query("COMMIT");
    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertReward(pool: pg.Pool, actorId: string, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : randomUUID();
  const title = required(input.title, "Название", 200);
  const description = required(input.description, "Описание", 2_000);
  const costText = String(input.costMinor ?? "").trim();
  if (!/^\d+$/.test(costText) || BigInt(costText) <= 0n) throw Object.assign(new Error("Стоимость должна быть положительным целым числом в сотых долях бонуса."), { statusCode: 400 });
  const availability = input.availabilityCount === null || input.availabilityCount === undefined || input.availabilityCount === ""
    ? null
    : Math.floor(Number(input.availabilityCount));
  if (availability !== null && (!Number.isSafeInteger(availability) || availability < 0)) throw Object.assign(new Error("Проверьте остаток награды."), { statusCode: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO app_rewards (
         id, title, image_url, description, cost_minor, availability_count,
         conditions, is_active, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, image_url = EXCLUDED.image_url,
         description = EXCLUDED.description, cost_minor = EXCLUDED.cost_minor,
         availability_count = EXCLUDED.availability_count, conditions = EXCLUDED.conditions,
         is_active = EXCLUDED.is_active, updated_at = now()`,
      [
        id, title, httpsUrlOrNull(input.imageUrl), description, costText, availability,
        typeof input.conditions === "string" ? input.conditions.trim().slice(0, 2_000) || null : null,
        input.isActive !== false, actorId
      ]
    );
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'reward.upserted', 'reward', $3, $4::jsonb)`,
      [randomUUID(), actorId, id, JSON.stringify({ title, costMinor: costText })]
    );
    await client.query("COMMIT");
    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertLoyaltyPromotion(pool: pg.Pool, actorId: string, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : randomUUID();
  const scopeType = input.scopeType === "product" || input.scopeType === "brand" ? input.scopeType : null;
  const multiplier = Math.floor(Number(input.multiplierBps));
  const startsAt = dateOrNull(input.startsAt, "Начало");
  const endsAt = dateOrNull(input.endsAt, "Окончание");
  if (!scopeType || !startsAt || !endsAt || endsAt <= startsAt || multiplier < 10_000 || multiplier > 100_000) {
    throw Object.assign(new Error("Проверьте область, множитель и даты акции."), { statusCode: 400 });
  }
  const title = required(input.title, "Название", 200);
  const scopeValue = required(input.scopeValue, "Товар или бренд", 200);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO app_loyalty_promotions (
         id, title, description, scope_type, scope_value, multiplier_bps,
         starts_at, ends_at, image_url, is_active, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         scope_type = EXCLUDED.scope_type, scope_value = EXCLUDED.scope_value,
         multiplier_bps = EXCLUDED.multiplier_bps, starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at, image_url = EXCLUDED.image_url,
         is_active = EXCLUDED.is_active, updated_at = now()`,
      [
        id, title, typeof input.description === "string" ? input.description.trim().slice(0, 2_000) || null : null,
        scopeType, scopeValue, multiplier, startsAt.toISOString(), endsAt.toISOString(),
        httpsUrlOrNull(input.imageUrl), input.isActive !== false, actorId
      ]
    );
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'promotion.upserted', 'loyalty_promotion', $3, $4::jsonb)`,
      [randomUUID(), actorId, id, JSON.stringify({ title, scopeType, scopeValue, multiplierBps: multiplier })]
    );
    await client.query("COMMIT");
    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setLoyaltyExclusion(pool: pg.Pool, actorId: string, input: Record<string, unknown>) {
  const scopeType = input.scopeType === "product" || input.scopeType === "brand" ? input.scopeType : null;
  if (!scopeType) throw Object.assign(new Error("Выберите тип исключения."), { statusCode: 400 });
  const scopeValue = required(input.scopeValue, "Товар или бренд", 200);
  const reason = required(input.reason, "Причина", 1_000);
  const id = typeof input.id === "string" && input.id ? input.id : randomUUID();
  await pool.query(
    `INSERT INTO app_loyalty_exclusions (id, scope_type, scope_value, reason, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (scope_type, scope_value) DO UPDATE SET
       reason = EXCLUDED.reason, is_active = EXCLUDED.is_active`,
    [id, scopeType, scopeValue, reason, input.isActive !== false, actorId]
  );
  await pool.query(
    `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, reason, metadata)
     VALUES ($1, $2, 'exclusion.upserted', 'loyalty_exclusion', $3, $4, $5::jsonb)`,
    [randomUUID(), actorId, id, reason, JSON.stringify({ scopeType, scopeValue, active: input.isActive !== false })]
  );
  return { id };
}

export async function getAdminProgramOverview(pool: pg.Pool) {
  const [counts, notificationMetrics, recentReceipts, redemptions] = await Promise.all([
    pool.query<{ pending_plumbers: string | number; approved_plumbers: string | number; open_leads: string | number }>(
      `SELECT
         (SELECT COUNT(*) FROM app_plumber_profiles WHERE application_status = 'pending') AS pending_plumbers,
         (SELECT COUNT(*) FROM app_plumber_profiles WHERE application_status = 'approved') AS approved_plumbers,
         (SELECT COUNT(*) FROM app_service_requests WHERE status IN ('new', 'viewed')) AS open_leads`
    ),
    getNotificationMetrics(pool),
    pool.query<{ id: string; external_receipt_id: string; receipt_number: string; total_minor: string | number; purchase_at: Date | string; loyalty_code: string }>(
      `SELECT receipts.id, receipts.external_receipt_id, receipts.receipt_number,
              receipts.total_minor, receipts.purchase_at, plumbers.loyalty_code
       FROM app_loyalty_receipts receipts JOIN app_plumber_profiles plumbers ON plumbers.id = receipts.plumber_id
       ORDER BY receipts.created_at DESC LIMIT 20`
    ),
    pool.query<{ id: string; status: string; cost_minor: string | number; created_at: Date | string; reward_title: string; plumber_name: string }>(
      `SELECT redemptions.id, redemptions.status, redemptions.cost_minor, redemptions.created_at,
              rewards.title AS reward_title, plumbers.full_name AS plumber_name
       FROM app_reward_redemptions redemptions
       JOIN app_rewards rewards ON rewards.id = redemptions.reward_id
       JOIN app_plumber_profiles plumbers ON plumbers.id = redemptions.plumber_id
       ORDER BY redemptions.created_at DESC LIMIT 20`
    )
  ]);
  const row = counts.rows[0];
  return {
    counts: {
      pendingPlumbers: Number(row?.pending_plumbers ?? 0),
      approvedPlumbers: Number(row?.approved_plumbers ?? 0),
      openLeads: Number(row?.open_leads ?? 0)
    },
    notifications: notificationMetrics,
    recentReceipts: recentReceipts.rows.map((receipt) => ({
      id: receipt.id,
      externalReceiptId: receipt.external_receipt_id,
      receiptNumber: receipt.receipt_number,
      totalMinor: String(receipt.total_minor),
      purchaseAt: new Date(receipt.purchase_at).toISOString(),
      loyaltyCode: receipt.loyalty_code
    })),
    redemptions: redemptions.rows.map((redemption) => ({
      id: redemption.id,
      status: redemption.status,
      costMinor: String(redemption.cost_minor),
      createdAt: new Date(redemption.created_at).toISOString(),
      rewardTitle: redemption.reward_title,
      plumberName: redemption.plumber_name
    }))
  };
}
