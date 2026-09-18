import {requireOwnedMedia} from "./media";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { enqueueNotification } from "./notifications";
import { requireApprovedPlumber } from "./plumbers";

export type ServiceRequestInput = {
  serviceType?: string;
  description?: string;
  district?: string;
  address?: string | null;
  preferredAt?: string | null;
  phone?: string;
  photoUrls?: string[];
  relatedProductIds?: string[];
  relatedOrderId?: string | null;
  consentToShare?: boolean;
};

type ServiceRequestRow = {
  id: string;
  customer_id: string;
  service_type: string;
  description: string;
  district: string;
  address_private: string | null;
  preferred_at: Date | string | null;
  customer_phone_private: string;
  photo_urls: unknown;
  related_product_ids: unknown;
  related_order_id: string | null;
  status: string;
  assigned_plumber_id: string | null;
  assigned_at: Date | string | null;
  accepted_at: Date | string | null;
  completed_at: Date | string | null;
  expires_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  plumber_name?: string | null;
  plumber_loyalty_code?: string | null;
  plumber_account_id?: string | null;
};

const requestColumns = `
  requests.id, requests.customer_id, requests.service_type, requests.description,
  requests.district, requests.address_private, requests.preferred_at,
  requests.customer_phone_private, requests.photo_urls, requests.related_product_ids,
  requests.related_order_id, requests.status, requests.assigned_plumber_id,
  requests.assigned_at, requests.accepted_at, requests.completed_at,
  requests.expires_at, requests.created_at, requests.updated_at,
  plumbers.full_name AS plumber_name, plumbers.loyalty_code AS plumber_loyalty_code,
  plumbers.account_id AS plumber_account_id
`;

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const validateUrls = (values: string[] | undefined) => {
  if (!values) return [];
  if (values.length > 5) throw Object.assign(new Error("Можно добавить не более 5 фотографий."), { statusCode: 400 });
  return values.map((value) => {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "https:") throw new Error();
      return url.toString().slice(0, 1_000);
    } catch {
      throw Object.assign(new Error("Фотографии должны использовать безопасные HTTPS-ссылки."), { statusCode: 400 });
    }
  });
};

const validateInput = (input: ServiceRequestInput) => {
  const serviceType = input.serviceType?.trim().slice(0, 120) || "";
  const description = input.description?.trim().slice(0, 2_000) || "";
  const district = input.district?.trim().slice(0, 120) || "";
  const address = input.address?.trim().slice(0, 500) || null;
  const phone = input.phone?.trim().slice(0, 40) || "";
  const preferredAt = input.preferredAt ? new Date(input.preferredAt) : null;
  const relatedProductIds = [...new Set((input.relatedProductIds ?? []).map((id) => id.trim()).filter(Boolean))].slice(0, 50);
  if (!serviceType || description.length < 10 || !district || !/^\+996\d{9}$/.test(phone)) {
    throw Object.assign(new Error("Укажите услугу, описание, район и телефон +996."), { statusCode: 400 });
  }
  if (preferredAt && Number.isNaN(preferredAt.getTime())) {
    throw Object.assign(new Error("Проверьте предпочтительную дату."), { statusCode: 400 });
  }
  if (!input.consentToShare) {
    throw Object.assign(new Error("Нужно согласие на передачу заявки выбранному сантехнику."), { statusCode: 400 });
  }
  return {
    serviceType,
    description,
    district,
    address,
    preferredAt,
    phone,
    photoUrls: validateUrls(input.photoUrls),
    relatedProductIds,
    relatedOrderId: input.relatedOrderId?.trim().slice(0, 100) || null
  };
};

const toRequest = (row: ServiceRequestRow, viewer: "customer" | "plumber" | "admin") => {
  const plumberMaySeePrivate = viewer === "plumber" && ["accepted", "in_progress", "completed"].includes(row.status);
  const showPrivate = viewer === "customer" || viewer === "admin" || plumberMaySeePrivate;
  return {
    id: row.id,
    serviceType: row.service_type,
    description: row.description,
    district: row.district,
    preferredAt: row.preferred_at ? new Date(row.preferred_at).toISOString() : null,
    relatedProductIds: asStringArray(row.related_product_ids),
    relatedOrderId: row.related_order_id,
    status: row.status,
    assignedAt: row.assigned_at ? new Date(row.assigned_at).toISOString() : null,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    contact: showPrivate ? { phone: row.customer_phone_private, address: row.address_private, photoUrls: asStringArray(row.photo_urls) } : null,
    assignedPlumber: row.assigned_plumber_id ? {
      id: row.assigned_plumber_id,
      name: row.plumber_name,
      loyaltyCode: viewer === "admin" || viewer === "customer" ? row.plumber_loyalty_code : null
    } : null
  };
};

export async function createServiceRequest(
  pool: pg.Pool,
  customerId: string,
  input: ServiceRequestInput,
  adminChatId?: string | null
) {
  const payload = validateInput(input);
  await requireOwnedMedia(pool,customerId,payload.photoUrls);
  if (payload.relatedOrderId) {
    const order = await pool.query("SELECT id FROM app_orders WHERE id = $1 AND customer_id = $2", [payload.relatedOrderId, customerId]);
    if (!order.rowCount) throw Object.assign(new Error("Связанный заказ не найден."), { statusCode: 404 });
  }
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO app_service_requests (
         id, customer_id, service_type, description, district, address_private,
         preferred_at, customer_phone_private, photo_urls, related_product_ids,
         related_order_id, consent_shared_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, now())`,
      [
        id, customerId, payload.serviceType, payload.description, payload.district,
        payload.address, payload.preferredAt?.toISOString() ?? null, payload.phone,
        JSON.stringify(payload.photoUrls), JSON.stringify(payload.relatedProductIds), payload.relatedOrderId
      ]
    );
    await client.query(
      `INSERT INTO app_service_request_events (id, request_id, previous_status, next_status, actor_id)
       VALUES ($1, $2, NULL, 'new', $3)`,
      [randomUUID(), id, customerId]
    );
    if (adminChatId) {
      await enqueueNotification(client, {
        targetChatId: adminChatId,
        eventType: "lead.created",
        dedupeKey: `lead:${id}:created:admin`,
        text: `🔧 Новая заявка клиента\nУслуга: ${payload.serviceType}\nРайон: ${payload.district}\nНазначьте подтверждённого сантехника в приложении администратора. Личные данные клиента скрыты.`
      });
    }
    await client.query("COMMIT");
    return getCustomerServiceRequest(pool, customerId, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const selectRequest = async (pool: pg.Pool, clause: string, params: unknown[]) => {
  const result = await pool.query<ServiceRequestRow>(
    `SELECT ${requestColumns}
     FROM app_service_requests requests
     LEFT JOIN app_plumber_profiles plumbers ON plumbers.id = requests.assigned_plumber_id
     WHERE ${clause} LIMIT 1`,
    params
  );
  return result.rows[0] ?? null;
};

export async function getCustomerServiceRequest(pool: pg.Pool, customerId: string, requestId: string) {
  const row = await selectRequest(pool, "requests.id = $1 AND requests.customer_id = $2", [requestId, customerId]);
  if (!row) throw Object.assign(new Error("Заявка не найдена."), { statusCode: 404 });
  return toRequest(row, "customer");
}

export async function listCustomerServiceRequests(pool: pg.Pool, customerId: string, limit = 30, offset = 0) {
  const result = await pool.query<ServiceRequestRow>(
    `SELECT ${requestColumns}
     FROM app_service_requests requests
     LEFT JOIN app_plumber_profiles plumbers ON plumbers.id = requests.assigned_plumber_id
     WHERE requests.customer_id = $1 ORDER BY requests.created_at DESC
     LIMIT $2 OFFSET $3`,
    [customerId, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)]
  );
  return result.rows.map((row) => toRequest(row, "customer"));
}

export async function listPlumberLeads(pool: pg.Pool, accountId: string, limit = 30, offset = 0) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  await pool.query(
    `UPDATE app_service_requests SET status = 'expired', updated_at = now()
     WHERE assigned_plumber_id = $1 AND status IN ('new', 'viewed') AND expires_at <= now()`,
    [plumber.id]
  );
  const result = await pool.query<ServiceRequestRow>(
    `SELECT ${requestColumns}
     FROM app_service_requests requests
     LEFT JOIN app_plumber_profiles plumbers ON plumbers.id = requests.assigned_plumber_id
     WHERE requests.assigned_plumber_id = $1
     ORDER BY CASE requests.status WHEN 'new' THEN 0 WHEN 'viewed' THEN 1 ELSE 2 END,
              requests.created_at DESC LIMIT $2 OFFSET $3`,
    [plumber.id, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)]
  );
  return result.rows.map((row) => toRequest(row, "plumber"));
}

export async function markLeadViewed(pool: pg.Pool, accountId: string, requestId: string) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  const result = await pool.query(
    `UPDATE app_service_requests SET status = 'viewed', updated_at = now()
     WHERE id = $1 AND assigned_plumber_id = $2 AND status = 'new' AND expires_at > now()`,
    [requestId, plumber.id]
  );
  if (result.rowCount) {
    await pool.query(
      `INSERT INTO app_service_request_events (id, request_id, previous_status, next_status, actor_id)
       VALUES ($1, $2, 'new', 'viewed', $3)`,
      [randomUUID(), requestId, accountId]
    );
  }
  const row = await selectRequest(pool, "requests.id = $1 AND requests.assigned_plumber_id = $2", [requestId, plumber.id]);
  if (!row) throw Object.assign(new Error("Заявка не найдена."), { statusCode: 404 });
  return toRequest(row, "plumber");
}

export async function updateLeadByPlumber(
  pool: pg.Pool,
  accountId: string,
  requestId: string,
  nextStatus: "accepted" | "declined" | "in_progress" | "completed"
) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ status: string; customer_id: string; service_type: string }>(
      `SELECT status, customer_id, service_type FROM app_service_requests
       WHERE id = $1 AND assigned_plumber_id = $2 FOR UPDATE`,
      [requestId, plumber.id]
    );
    const row = current.rows[0];
    if (!row) throw Object.assign(new Error("Заявка не найдена или назначена другому сантехнику."), { statusCode: 404 });
    if (row.status === nextStatus) {
      await client.query("COMMIT");
      const same = await selectRequest(pool, "requests.id = $1 AND requests.assigned_plumber_id = $2", [requestId, plumber.id]);
      return same ? toRequest(same, "plumber") : null;
    }
    const allowed: Record<string, string[]> = {
      new: ["accepted", "declined"],
      viewed: ["accepted", "declined"],
      accepted: ["in_progress"],
      in_progress: ["completed"]
    };
    if (!allowed[row.status]?.includes(nextStatus)) {
      throw Object.assign(new Error("Заявку уже принял другой специалист или переход статуса недоступен."), { statusCode: 409 });
    }
    if (["new", "viewed"].includes(row.status)) {
      const expiry = await client.query<{ valid: boolean }>("SELECT expires_at > now() AS valid FROM app_service_requests WHERE id = $1", [requestId]);
      if (!expiry.rows[0]?.valid) throw Object.assign(new Error("Срок заявки истёк."), { statusCode: 409 });
    }
    await client.query(
      `UPDATE app_service_requests
       SET status = $1,
           accepted_at = CASE WHEN $1 = 'accepted' THEN now() ELSE accepted_at END,
           completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END,
           updated_at = now()
       WHERE id = $2 AND assigned_plumber_id = $3`,
      [nextStatus, requestId, plumber.id]
    );
    await client.query(
      `INSERT INTO app_service_request_events (id, request_id, previous_status, next_status, actor_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), requestId, row.status, nextStatus, accountId]
    );
    await enqueueNotification(client, {
      recipientAccountId: row.customer_id,
      eventType: `lead.${nextStatus}`,
      dedupeKey: `lead:${requestId}:${nextStatus}`,
      text: `Статус заявки «${row.service_type}» обновлён: ${nextStatus === "accepted" ? "сантехник принял заявку" : nextStatus === "declined" ? "требуется новое назначение" : nextStatus === "in_progress" ? "работа началась" : "работа завершена"}.`
    });
    await client.query("COMMIT");
    const updated = await selectRequest(pool, "requests.id = $1 AND requests.assigned_plumber_id = $2", [requestId, plumber.id]);
    return updated ? toRequest(updated, "plumber") : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelCustomerServiceRequest(pool: pg.Pool, customerId: string, requestId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ status: string; plumber_account_id: string | null }>(
      `SELECT requests.status, plumbers.account_id AS plumber_account_id
       FROM app_service_requests requests
       LEFT JOIN app_plumber_profiles plumbers ON plumbers.id = requests.assigned_plumber_id
       WHERE requests.id = $1 AND requests.customer_id = $2 FOR UPDATE OF requests`,
      [requestId, customerId]
    );
    const row = current.rows[0];
    if (!row) throw Object.assign(new Error("Заявка не найдена."), { statusCode: 404 });
    if (["completed", "cancelled", "expired"].includes(row.status)) throw Object.assign(new Error("Эту заявку уже нельзя отменить."), { statusCode: 409 });
    await client.query("UPDATE app_service_requests SET status = 'cancelled', updated_at = now() WHERE id = $1", [requestId]);
    await client.query(
      `INSERT INTO app_service_request_events (id, request_id, previous_status, next_status, actor_id)
       VALUES ($1, $2, $3, 'cancelled', $4)`,
      [randomUUID(), requestId, row.status, customerId]
    );
    if (row.plumber_account_id) {
      await enqueueNotification(client, {
        recipientAccountId: row.plumber_account_id,
        eventType: "lead.cancelled",
        dedupeKey: `lead:${requestId}:cancelled`,
        text: "Клиент отменил назначенную вам заявку. Личные данные больше недоступны."
      });
    }
    await client.query("COMMIT");
    return getCustomerServiceRequest(pool, customerId, requestId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAdminServiceRequests(pool: pg.Pool, limit = 50, offset = 0) {
  const result = await pool.query<ServiceRequestRow>(
    `SELECT ${requestColumns}
     FROM app_service_requests requests
     LEFT JOIN app_plumber_profiles plumbers ON plumbers.id = requests.assigned_plumber_id
     ORDER BY CASE requests.status WHEN 'new' THEN 0 ELSE 1 END, requests.created_at DESC
     LIMIT $1 OFFSET $2`,
    [Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)]
  );
  return result.rows.map((row) => toRequest(row, "admin"));
}

export async function listLeadCandidates(pool: pg.Pool, requestId: string) {
  const request = await pool.query<{ service_type: string; district: string }>(
    "SELECT service_type, district FROM app_service_requests WHERE id = $1",
    [requestId]
  );
  if (!request.rows[0]) throw Object.assign(new Error("Заявка не найдена."), { statusCode: 404 });
  const result = await pool.query<{
    id: string; account_id: string; full_name: string; loyalty_code: string;
    working_districts: unknown; specializations: unknown; is_available_for_leads: boolean;
    rating: string | number | null; reviews_count: string | number;
    completed_count: string | number; assigned_count: string | number; reported_count: string | number;
  }>(
    `SELECT plumbers.id, plumbers.account_id, plumbers.full_name, plumbers.loyalty_code,
            plumbers.working_districts, plumbers.specializations, plumbers.is_available_for_leads,
            review_stats.rating, COALESCE(review_stats.reviews_count, 0) AS reviews_count,
            COALESCE(lead_stats.completed_count, 0) AS completed_count,
            COALESCE(lead_stats.assigned_count, 0) AS assigned_count,
            COALESCE(review_stats.reported_count, 0) AS reported_count
     FROM app_plumber_profiles plumbers
     LEFT JOIN LATERAL (
       SELECT ROUND(AVG(rating) FILTER (WHERE moderation_status = 'published')::numeric, 2) AS rating,
              COUNT(*) FILTER (WHERE moderation_status = 'published') AS reviews_count,
              COUNT(*) FILTER (WHERE moderation_status = 'reported') AS reported_count
       FROM app_plumber_reviews WHERE plumber_id = plumbers.id
     ) review_stats ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE status = 'completed') AS completed_count, COUNT(*) AS assigned_count
       FROM app_service_requests WHERE assigned_plumber_id = plumbers.id
     ) lead_stats ON true
     WHERE plumbers.application_status = 'approved' AND plumbers.is_available_for_leads = true`
  );
  const service = request.rows[0].service_type.toLowerCase();
  const district = request.rows[0].district.toLowerCase();
  return result.rows.map((row) => {
    const districts = asStringArray(row.working_districts);
    const specializations = asStringArray(row.specializations);
    const districtMatch = districts.some((item) => item.toLowerCase() === district);
    const specializationMatch = specializations.some((item) => service.includes(item.toLowerCase()) || item.toLowerCase().includes(service));
    const assigned = Number(row.assigned_count);
    const completionRate = assigned > 0 ? Number(row.completed_count) / assigned : 0.5;
    const rating = row.rating === null ? 0 : Number(row.rating);
    // Match and service quality dominate; loyalty purchase volume is deliberately absent.
    const score = (specializationMatch ? 35 : 0) + (districtMatch ? 30 : 0) +
      Math.round(rating * 5) + Math.round(completionRate * 10) - Math.min(Number(row.reported_count) * 10, 30);
    return {
      id: row.id,
      accountId: row.account_id,
      fullName: row.full_name,
      loyaltyCode: row.loyalty_code,
      districts,
      specializations,
      rating: row.rating === null ? null : rating,
      reviewsCount: Number(row.reviews_count),
      completionRate,
      districtMatch,
      specializationMatch,
      score
    };
  }).sort((left, right) => right.score - left.score || right.completionRate - left.completionRate);
}

export async function assignServiceRequest(pool: pg.Pool, actorId: string, requestId: string, plumberId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const request = await client.query<{ status: string; assigned_plumber_id: string | null; service_type: string; district: string }>(
      "SELECT status, assigned_plumber_id, service_type, district FROM app_service_requests WHERE id = $1 FOR UPDATE",
      [requestId]
    );
    const profile = await client.query<{ account_id: string; application_status: string; is_available_for_leads: boolean }>(
      "SELECT account_id, application_status, is_available_for_leads FROM app_plumber_profiles WHERE id = $1",
      [plumberId]
    );
    if (!request.rows[0]) throw Object.assign(new Error("Заявка не найдена."), { statusCode: 404 });
    if (!profile.rows[0] || profile.rows[0].application_status !== "approved" || !profile.rows[0].is_available_for_leads) {
      throw Object.assign(new Error("Выберите доступного подтверждённого сантехника."), { statusCode: 409 });
    }
    if (["accepted", "in_progress", "completed", "cancelled", "expired"].includes(request.rows[0].status)) {
      throw Object.assign(new Error("Эту заявку уже нельзя переназначить."), { statusCode: 409 });
    }
    if (request.rows[0].assigned_plumber_id === plumberId) {
      await client.query("COMMIT");
      return { assigned: false };
    }
    const assignmentEventId = randomUUID();
    const previousPlumber = request.rows[0].assigned_plumber_id
      ? await client.query<{ account_id: string }>("SELECT account_id FROM app_plumber_profiles WHERE id = $1", [request.rows[0].assigned_plumber_id])
      : null;
    await client.query(
      `UPDATE app_service_requests SET assigned_plumber_id = $1, assigned_by = $2,
       assigned_at = now(), status = 'new', updated_at = now() WHERE id = $3`,
      [plumberId, actorId, requestId]
    );
    await client.query(
      `INSERT INTO app_service_request_events (id, request_id, previous_status, next_status, actor_id, metadata)
       VALUES ($1, $2, $3, 'new', $4, $5::jsonb)`,
      [assignmentEventId, requestId, request.rows[0].status, actorId, JSON.stringify({ previousPlumberId: request.rows[0].assigned_plumber_id, plumberId })]
    );
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'lead.assigned', 'service_request', $3, $4::jsonb)`,
      [randomUUID(), actorId, requestId, JSON.stringify({ plumberId, previousPlumberId: request.rows[0].assigned_plumber_id })]
    );
    await enqueueNotification(client, {
      recipientAccountId: profile.rows[0].account_id,
      eventType: "lead.assigned",
      dedupeKey: `lead:${requestId}:assignment:${assignmentEventId}`,
      text: `Новая заявка: ${request.rows[0].service_type}, район ${request.rows[0].district}. Откройте приложение, чтобы посмотреть и ответить. Адрес и телефон откроются только после принятия.`
    });
    if (previousPlumber?.rows[0]?.account_id) {
      await enqueueNotification(client, {
        recipientAccountId: previousPlumber.rows[0].account_id,
        eventType: "lead.reassigned",
        dedupeKey: `lead:${requestId}:reassigned:${assignmentEventId}`,
        text: "Заявка переназначена другому специалисту и больше не доступна."
      });
    }
    await client.query("COMMIT");
    return { assigned: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createLeadReview(
  pool: pg.Pool,
  customerId: string,
  requestId: string,
  input: { rating: number; review?: string | null; tags?: string[] }
) {
  const rating = Math.floor(Number(input.rating));
  const review = input.review?.trim().slice(0, 2_000) || null;
  const tags = [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 10);
  if (rating < 1 || rating > 5) throw Object.assign(new Error("Поставьте оценку от 1 до 5."), { statusCode: 400 });
  const request = await pool.query<{ assigned_plumber_id: string | null }>(
    `SELECT assigned_plumber_id FROM app_service_requests
     WHERE id = $1 AND customer_id = $2 AND status = 'completed'`,
    [requestId, customerId]
  );
  if (!request.rows[0]?.assigned_plumber_id) throw Object.assign(new Error("Отзыв доступен только после завершённой заявки."), { statusCode: 403 });
  try {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO app_plumber_reviews (id, request_id, customer_id, plumber_id, rating, review_text, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [id, requestId, customerId, request.rows[0].assigned_plumber_id, rating, review, JSON.stringify(tags)]
    );
    return { id, rating, review, tags, moderationStatus: "published" };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw Object.assign(new Error("Для этой заявки отзыв уже оставлен."), { statusCode: 409 });
    }
    throw error;
  }
}

export async function moderateReview(
  pool: pg.Pool,
  actorId: string,
  reviewId: string,
  status: "published" | "hidden" | "reported",
  reason: string
) {
  const safeReason = reason.trim().slice(0, 1_000);
  if (status !== "published" && !safeReason) throw Object.assign(new Error("Укажите причину модерации."), { statusCode: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ moderation_status: string }>("SELECT moderation_status FROM app_plumber_reviews WHERE id = $1 FOR UPDATE", [reviewId]);
    if (!current.rows[0]) throw Object.assign(new Error("Отзыв не найден."), { statusCode: 404 });
    await client.query(
      `UPDATE app_plumber_reviews SET moderation_status = $1, moderation_reason = $2,
       moderated_by = $3, updated_at = now() WHERE id = $4`,
      [status, safeReason || null, actorId, reviewId]
    );
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, reason, metadata)
       VALUES ($1, $2, 'review.moderated', 'review', $3, $4, $5::jsonb)`,
      [randomUUID(), actorId, reviewId, safeReason || null, JSON.stringify({ previousStatus: current.rows[0].moderation_status, status })]
    );
    await client.query("COMMIT");
    return { status };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPlumberReviews(pool: pg.Pool, accountId: string, limit = 20) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  const result = await pool.query<{
    id: string; rating: number; review_text: string | null; tags: unknown; created_at: Date | string;
  }>(
    `SELECT id, rating, review_text, tags, created_at FROM app_plumber_reviews
     WHERE plumber_id = $1 AND moderation_status = 'published'
     ORDER BY created_at DESC LIMIT $2`,
    [plumber.id, Math.min(Math.max(limit, 1), 100)]
  );
  return result.rows.map((row) => ({
    id: row.id, rating: row.rating, review: row.review_text,
    tags: asStringArray(row.tags), createdAt: new Date(row.created_at).toISOString()
  }));
}
