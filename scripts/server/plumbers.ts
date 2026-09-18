import {requireOwnedMedia} from "./media";
import {requireConsentVersions} from "./documents";
import { randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";

export const PLUMBER_APPLICATION_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type PlumberApplicationStatus = (typeof PLUMBER_APPLICATION_STATUSES)[number];

export type PlumberApplicationInput = {
  fullName?: string;
  city?: string;
  workingDistricts?: string[];
  specializations?: string[];
  experienceYears?: number;
  profilePhotoUrl?: string | null;
  description?: string | null;
  programDocumentVersion?: string;
  privacyDocumentVersion?: string;
  programConsent?: boolean;
  dataProcessingConsent?: boolean;
};

type Queryable = pg.Pool | pg.PoolClient;

type PlumberRow = {
  id: string;
  account_id: string;
  public_id: string;
  loyalty_code: string;
  application_status: PlumberApplicationStatus;
  full_name: string;
  phone: string;
  city: string;
  working_districts: unknown;
  specializations: unknown;
  experience_years: number;
  profile_photo_url: string | null;
  description: string | null;
  is_available_for_leads: boolean;
  notification_preferences: unknown;
  rejection_reason: string | null;
  suspension_reason: string | null;
  verified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  telegram_user_id: string | number | null;
  telegram_username: string | null;
  telegram_notifications_enabled: boolean | null;
  rating: string | number | null;
  reviews_count: string | number;
};

const profileColumns = `
  plumbers.id, plumbers.account_id, plumbers.public_id, plumbers.loyalty_code,
  plumbers.application_status, plumbers.full_name, accounts.phone,
  plumbers.city, plumbers.working_districts, plumbers.specializations,
  plumbers.experience_years, plumbers.profile_photo_url, plumbers.description,
  plumbers.is_available_for_leads, plumbers.notification_preferences,
  plumbers.rejection_reason, plumbers.suspension_reason, plumbers.verified_at,
  plumbers.created_at, plumbers.updated_at,
  telegram.telegram_user_id, telegram.telegram_username,
  telegram.notifications_enabled AS telegram_notifications_enabled,
  reviews.rating, COALESCE(reviews.reviews_count, 0) AS reviews_count
`;

const profileJoins = `
  JOIN app_customers accounts ON accounts.id = plumbers.account_id
  LEFT JOIN app_telegram_links telegram ON telegram.account_id = plumbers.account_id
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(rating)::numeric, 2) AS rating, COUNT(*)::integer AS reviews_count
    FROM app_plumber_reviews
    WHERE plumber_id = plumbers.id AND moderation_status = 'published'
  ) reviews ON true
`;

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const toIsoOrNull = (value: Date | string | null) => value ? new Date(value).toISOString() : null;

const toPlumberProfile = (row: PlumberRow) => ({
  id: row.id,
  accountId: row.account_id,
  publicId: row.public_id,
  loyaltyCode: row.loyalty_code,
  applicationStatus: row.application_status,
  fullName: row.full_name,
  phone: row.phone,
  city: row.city,
  workingDistricts: asStringArray(row.working_districts),
  specializations: asStringArray(row.specializations),
  experienceYears: row.experience_years,
  profilePhotoUrl: row.profile_photo_url,
  description: row.description,
  isAvailableForLeads: row.is_available_for_leads,
  notificationPreferences:
    row.notification_preferences && typeof row.notification_preferences === "object"
      ? row.notification_preferences as Record<string, boolean>
      : {},
  telegram: {
    connected: row.telegram_user_id !== null,
    username: row.telegram_username,
    notificationsEnabled: row.telegram_notifications_enabled ?? false
  },
  rating: row.rating === null ? null : Number(row.rating),
  reviewsCount: Number(row.reviews_count),
  rejectionReason: row.rejection_reason,
  suspensionReason: row.suspension_reason,
  verifiedAt: toIsoOrNull(row.verified_at),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

const sanitizeList = (items: string[] | undefined, maxItems: number) =>
  [...new Set((items ?? []).map((item) => item.trim()).filter(Boolean))]
    .slice(0, maxItems)
    .map((item) => item.slice(0, 80));

const validateHttpsUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim() || "";
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      throw new Error();
    }
    return url.toString().slice(0, 500);
  } catch {
    throw Object.assign(new Error("Фото профиля должно использовать безопасную HTTPS-ссылку."), { statusCode: 400 });
  }
};

export const validatePlumberApplication = (payload: PlumberApplicationInput) => {
  const fullName = payload.fullName?.trim().slice(0, 200) || "";
  const city = payload.city?.trim().slice(0, 100) || "Бишкек";
  const workingDistricts = sanitizeList(payload.workingDistricts, 12);
  const specializations = sanitizeList(payload.specializations, 16);
  const experienceYears = Math.floor(Number(payload.experienceYears ?? 0));
  const description = payload.description?.trim().slice(0, 1_000) || null;

  if (fullName.length < 2 || city.length < 2) {
    throw Object.assign(new Error("Укажите имя и город."), { statusCode: 400 });
  }
  if (!workingDistricts.length) {
    throw Object.assign(new Error("Укажите хотя бы один рабочий район."), { statusCode: 400 });
  }
  if (!specializations.length) {
    throw Object.assign(new Error("Укажите хотя бы одну специализацию."), { statusCode: 400 });
  }
  if (!Number.isSafeInteger(experienceYears) || experienceYears < 0 || experienceYears > 80) {
    throw Object.assign(new Error("Проверьте стаж работы."), { statusCode: 400 });
  }
  if (!payload.programConsent || !payload.dataProcessingConsent) {
    throw Object.assign(new Error("Для подачи заявки необходимо принять правила программы и обработку данных."), {
      statusCode: 400
    });
  }

  return {
    fullName,
    city,
    workingDistricts,
    specializations,
    experienceYears,
    profilePhotoUrl: validateHttpsUrl(payload.profilePhotoUrl),
    description
  };
};

export const generatePlumberIdentifiers = () => {
  const publicId = randomBytes(18).toString("base64url");
  const readable = randomBytes(6).toString("hex").toUpperCase();
  const loyaltyCode = `AVP-${readable.slice(0, 4)}-${readable.slice(4, 8)}-${readable.slice(8, 12)}`;
  return { publicId, loyaltyCode, qrPayload: `AVANT:PLUMBER:${publicId}` };
};

export async function createPlumberApplicationRecord(
  database: Queryable,
  accountId: string,
  payload: PlumberApplicationInput
) {
  const application = validatePlumberApplication(payload);
  await requireConsentVersions(database,payload.programDocumentVersion,payload.privacyDocumentVersion);
  await requireOwnedMedia(database,accountId,application.profilePhotoUrl?[application.profilePhotoUrl]:[]);
  const existing = await database.query<{ id: string; application_status: PlumberApplicationStatus }>(
    "SELECT id, application_status FROM app_plumber_profiles WHERE account_id = $1 LIMIT 1",
    [accountId]
  );

  if (existing.rows[0]) {
    if (existing.rows[0].application_status !== "rejected") {
      throw Object.assign(new Error("Заявка сантехника для этого аккаунта уже существует."), { statusCode: 409 });
    }

    await database.query(
      `UPDATE app_plumber_profiles
       SET application_status = 'pending', full_name = $2, city = $3,
           working_districts = $4::jsonb, specializations = $5::jsonb,
           experience_years = $6, profile_photo_url = $7, description = $8,
           program_consent_at = now(), data_processing_consent_at = now(),
           program_document_version=$9, privacy_document_version=$10,
           rejection_reason = NULL, suspension_reason = NULL, verified_by = NULL,
           verified_at = NULL, updated_at = now()
       WHERE account_id = $1`,
      [
        accountId,
        application.fullName,
        application.city,
        JSON.stringify(application.workingDistricts),
        JSON.stringify(application.specializations),
        application.experienceYears,
        application.profilePhotoUrl,
        application.description, payload.programDocumentVersion, payload.privacyDocumentVersion
      ]
    );
    await database.query(
      `INSERT INTO app_plumber_status_events (id, plumber_id, previous_status, next_status, reason, actor_id)
       VALUES ($1, $2, 'rejected', 'pending', 'Повторная подача заявки', $3)`,
      [randomUUID(), existing.rows[0].id, accountId]
    );
    return getPlumberProfileByAccount(database, accountId);
  }

  const identifiers = generatePlumberIdentifiers();
  const id = randomUUID();
  await database.query(
    `INSERT INTO app_plumber_profiles (
       id, account_id, public_id, loyalty_code, application_status,
       full_name, city, working_districts, specializations, experience_years,
       profile_photo_url, description, program_consent_at, data_processing_consent_at, program_document_version, privacy_document_version
     ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, now(), now(), $12, $13)`,
    [
      id,
      accountId,
      identifiers.publicId,
      identifiers.loyaltyCode,
      application.fullName,
      application.city,
      JSON.stringify(application.workingDistricts),
      JSON.stringify(application.specializations),
      application.experienceYears,
      application.profilePhotoUrl,
      application.description, payload.programDocumentVersion, payload.privacyDocumentVersion
    ]
  );
  await database.query(
    `INSERT INTO app_plumber_status_events (id, plumber_id, previous_status, next_status, actor_id)
     VALUES ($1, $2, NULL, 'pending', $3)`,
    [randomUUID(), id, accountId]
  );

  return getPlumberProfileByAccount(database, accountId);
}

export async function applyForPlumber(pool: pg.Pool, accountId: string, payload: PlumberApplicationInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = await client.query<{ id: string }>(
      "SELECT id FROM app_customers WHERE id = $1 FOR UPDATE",
      [accountId]
    );
    if (!account.rows[0]) {
      throw Object.assign(new Error("Аккаунт не найден."), { statusCode: 404 });
    }
    const profile = await createPlumberApplicationRecord(client, accountId, payload);
    await client.query("COMMIT");
    return profile;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPlumberProfileByAccount(database: Queryable, accountId: string) {
  const result = await database.query<PlumberRow>(
    `SELECT ${profileColumns}
     FROM app_plumber_profiles plumbers
     ${profileJoins}
     WHERE plumbers.account_id = $1
     LIMIT 1`,
    [accountId]
  );
  return result.rows[0] ? toPlumberProfile(result.rows[0]) : null;
}

export async function getPlumberProfileByPublicIdentifier(database: Queryable, identifier: string) {
  const result = await database.query<PlumberRow>(
    `SELECT ${profileColumns}
     FROM app_plumber_profiles plumbers
     ${profileJoins}
     WHERE plumbers.public_id = $1 OR UPPER(plumbers.loyalty_code) = UPPER($1)
     LIMIT 1`,
    [identifier.trim()]
  );
  return result.rows[0] ? toPlumberProfile(result.rows[0]) : null;
}

export async function requireApprovedPlumber(database: Queryable, accountId: string) {
  const profile = await getPlumberProfileByAccount(database, accountId);
  if (!profile) {
    throw Object.assign(new Error("Сначала подайте заявку сантехника."), { statusCode: 403 });
  }
  if (profile.applicationStatus !== "approved") {
    throw Object.assign(new Error("Функция доступна после подтверждения анкеты сантехника."), { statusCode: 403 });
  }
  return profile;
}

export async function listPlumberApplications(pool: pg.Pool, status?: PlumberApplicationStatus, limit = 50, offset = 0) {
  const result = await pool.query<PlumberRow>(
    `SELECT ${profileColumns}
     FROM app_plumber_profiles plumbers
     ${profileJoins}
     WHERE ($1::text IS NULL OR plumbers.application_status = $1)
     ORDER BY CASE plumbers.application_status WHEN 'pending' THEN 0 ELSE 1 END, plumbers.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status ?? null, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)]
  );
  return result.rows.map(toPlumberProfile);
}

export async function updatePlumberApplicationStatus(
  pool: pg.Pool,
  actorId: string,
  plumberId: string,
  nextStatus: PlumberApplicationStatus,
  reason?: string | null
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ account_id: string; application_status: PlumberApplicationStatus }>(
      "SELECT account_id, application_status FROM app_plumber_profiles WHERE id = $1 FOR UPDATE",
      [plumberId]
    );
    const row = current.rows[0];
    if (!row) {
      throw Object.assign(new Error("Анкета сантехника не найдена."), { statusCode: 404 });
    }
    if (row.application_status === nextStatus) {
      await client.query("COMMIT");
      return { changed: false, profile: await getPlumberProfileByAccount(pool, row.account_id) };
    }
    if ((nextStatus === "rejected" || nextStatus === "suspended") && !reason?.trim()) {
      throw Object.assign(new Error("Укажите обязательную причину изменения статуса."), { statusCode: 400 });
    }

    await client.query(
      `UPDATE app_plumber_profiles
       SET application_status = $1,
           rejection_reason = CASE WHEN $1 = 'rejected' THEN $2 ELSE NULL END,
           suspension_reason = CASE WHEN $1 = 'suspended' THEN $2 ELSE NULL END,
           verified_by = CASE WHEN $1 = 'approved' THEN $3 ELSE verified_by END,
           verified_at = CASE WHEN $1 = 'approved' THEN now() ELSE verified_at END,
           updated_at = now()
       WHERE id = $4`,
      [nextStatus, reason?.trim().slice(0, 1_000) || null, actorId, plumberId]
    );
    await client.query(
      `INSERT INTO app_account_roles (account_id, role, is_active, granted_by)
       VALUES ($1, 'plumber', $2, $3)
       ON CONFLICT (account_id, role)
       DO UPDATE SET is_active = EXCLUDED.is_active, granted_by = EXCLUDED.granted_by,
                     granted_at = CASE WHEN EXCLUDED.is_active THEN now() ELSE app_account_roles.granted_at END`,
      [row.account_id, nextStatus === "approved", actorId]
    );
    await client.query(
      `INSERT INTO app_plumber_status_events (id, plumber_id, previous_status, next_status, reason, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), plumberId, row.application_status, nextStatus, reason?.trim().slice(0, 1_000) || null, actorId]
    );
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, reason, metadata)
       VALUES ($1, $2, 'plumber.status_changed', 'plumber', $3, $4, $5::jsonb)`,
      [
        randomUUID(),
        actorId,
        plumberId,
        reason?.trim().slice(0, 1_000) || null,
        JSON.stringify({ previousStatus: row.application_status, nextStatus })
      ]
    );
    await client.query("COMMIT");
    return { changed: true, profile: await getPlumberProfileByAccount(pool, row.account_id) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const plumberQrPayload = (publicId: string) => `AVANT:PLUMBER:${publicId}`;
