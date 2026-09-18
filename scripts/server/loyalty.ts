import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import { enqueueNotification } from "./notifications";
import {
  getPlumberProfileByPublicIdentifier,
  requireApprovedPlumber
} from "./plumbers";

type Queryable = pg.Pool | pg.PoolClient;
type ReceiptSource = "pos" | "1c" | "manual" | "fixture";

export type ReceiptLineInput = {
  externalLineId: string;
  productId?: string | null;
  productName: string;
  brand?: string | null;
  quantityMilli: string | number;
  unitPriceMinor: string | number;
  lineTotalMinor: string | number;
};

export type ReceiptInput = {
  externalReceiptId: string;
  receiptNumber: string;
  storeId: string;
  storeName?: string | null;
  plumberIdentifier: string;
  totalMinor: string | number;
  purchaseAt: string;
  source: ReceiptSource;
  items: ReceiptLineInput[];
};

export type ReturnInput = {
  externalReturnId: string;
  externalReceiptId: string;
  returnAt: string;
  source: ReceiptSource;
  items: Array<{
    externalLineId: string;
    quantityMilli: string | number;
    amountMinor: string | number;
  }>;
};

type LoyaltyConfigRow = {
  base_rate_bps: number;
  pending_days: number;
  rolling_period_days: number;
  updated_at: Date | string;
};

type LevelRow = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  threshold_minor: string | number;
  bonus_rate_bps: number;
  benefits: unknown;
  is_active: boolean;
};

const parseNonNegativeBigInt = (value: string | number | bigint, field: string) => {
  const text = typeof value === "bigint" ? value.toString() : String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw Object.assign(new Error(`${field}: используйте целое значение в тыйынах.`), { statusCode: 400 });
  }
  const parsed = BigInt(text);
  if (parsed > 9_000_000_000_000_000n) {
    throw Object.assign(new Error(`${field}: значение слишком большое.`), { statusCode: 400 });
  }
  return parsed;
};

const parseSignedBigInt = (value: string | number | bigint, field: string) => {
  const text = typeof value === "bigint" ? value.toString() : String(value).trim();
  if (!/^-?\d+$/.test(text)) {
    throw Object.assign(new Error(`${field}: используйте целое значение в тыйынах.`), { statusCode: 400 });
  }
  const parsed = BigInt(text);
  if (parsed > 9_000_000_000_000_000n || parsed < -9_000_000_000_000_000n) {
    throw Object.assign(new Error(`${field}: значение слишком большое.`), { statusCode: 400 });
  }
  return parsed;
};

const requiredText = (value: unknown, field: string, maxLength = 200) => {
  const text = typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  if (!text) throw Object.assign(new Error(`Заполните поле «${field}».`), { statusCode: 400 });
  return text;
};

const parseDate = (value: string, field: string) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`Проверьте поле «${field}».`), { statusCode: 400 });
  }
  return date;
};

const canonicalize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return typeof value === "bigint" ? value.toString() : value;
};

const contentHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const toLevel = (row: LevelRow) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  sortOrder: row.sort_order,
  thresholdMinor: String(row.threshold_minor),
  bonusRateBps: row.bonus_rate_bps,
  benefits: asStringArray(row.benefits),
  isActive: row.is_active
});

export async function getLoyaltyConfig(database: Queryable) {
  const config = await database.query<LoyaltyConfigRow>(
    "SELECT base_rate_bps, pending_days, rolling_period_days, updated_at FROM app_loyalty_config WHERE id = 1"
  );
  const levels = await database.query<LevelRow>(
    `SELECT id, code, name, sort_order, threshold_minor, bonus_rate_bps, benefits, is_active
     FROM app_loyalty_levels ORDER BY sort_order ASC`
  );
  const row = config.rows[0];
  if (!row) throw new Error("Loyalty configuration is missing.");
  return {
    baseRateBps: row.base_rate_bps,
    pendingDays: row.pending_days,
    rollingPeriodDays: row.rolling_period_days,
    updatedAt: new Date(row.updated_at).toISOString(),
    levels: levels.rows.map(toLevel)
  };
}

export async function calculateLevelProgress(
  database: Queryable,
  plumberId: string,
  referenceAt: Date = new Date()
) {
  const config = await getLoyaltyConfig(database);
  const purchases = await database.query<{ eligible_minor: string | number }>(
    `SELECT COALESCE(SUM(GREATEST(items.eligible_total_minor - items.returned_amount_minor, 0)), 0) AS eligible_minor
     FROM app_loyalty_receipts receipts
     JOIN app_loyalty_receipt_items items ON items.receipt_id = receipts.id
     WHERE receipts.plumber_id = $1
       AND receipts.purchase_at <= $2
       AND receipts.purchase_at >= $2::timestamptz - ($3::text || ' days')::interval`,
    [plumberId, referenceAt.toISOString(), config.rollingPeriodDays]
  );
  const eligibleMinor = BigInt(String(purchases.rows[0]?.eligible_minor ?? 0));
  const activeLevels = config.levels.filter((level) => level.isActive);
  if (!activeLevels.length) throw new Error("No active loyalty levels are configured.");
  const current = [...activeLevels]
    .reverse()
    .find((level) => eligibleMinor >= BigInt(level.thresholdMinor)) ?? activeLevels[0];
  const currentIndex = activeLevels.findIndex((level) => level.id === current.id);
  const next = activeLevels[currentIndex + 1] ?? null;
  const remaining = next ? BigInt(next.thresholdMinor) - eligibleMinor : 0n;
  const range = next ? BigInt(next.thresholdMinor) - BigInt(current.thresholdMinor) : 0n;
  const completed = eligibleMinor - BigInt(current.thresholdMinor);
  const progressPercent = next && range > 0n
    ? Number((completed * 10000n) / range) / 100
    : 100;
  return {
    rollingPeriodDays: config.rollingPeriodDays,
    eligiblePurchaseMinor: eligibleMinor.toString(),
    current,
    next,
    remainingMinor: remaining > 0n ? remaining.toString() : "0",
    progressPercent: Math.max(0, Math.min(progressPercent, 100)),
    levels: activeLevels
  };
}

const normalizeReceipt = (input: ReceiptInput) => {
  const externalReceiptId = requiredText(input.externalReceiptId, "ID чека", 200);
  const receiptNumber = requiredText(input.receiptNumber, "Номер чека", 100);
  const storeId = requiredText(input.storeId, "Магазин", 100);
  const plumberIdentifier = requiredText(input.plumberIdentifier, "Код сантехника", 200);
  const totalMinor = parseNonNegativeBigInt(input.totalMinor, "Сумма чека");
  const purchaseAt = parseDate(input.purchaseAt, "Дата покупки");
  const source = ["pos", "1c", "manual", "fixture"].includes(input.source) ? input.source : null;
  if (!source) throw Object.assign(new Error("Неизвестный источник чека."), { statusCode: 400 });
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 200) {
    throw Object.assign(new Error("Чек должен содержать от 1 до 200 позиций."), { statusCode: 400 });
  }
  const seen = new Set<string>();
  const items = input.items.map((item) => {
    const externalLineId = requiredText(item.externalLineId, "ID строки", 100);
    if (seen.has(externalLineId)) throw Object.assign(new Error("ID строк чека должны быть уникальными."), { statusCode: 400 });
    seen.add(externalLineId);
    return {
      externalLineId,
      productId: item.productId?.trim().slice(0, 200) || null,
      productName: requiredText(item.productName, "Название товара", 300),
      brand: item.brand?.trim().slice(0, 200) || null,
      quantityMilli: parseNonNegativeBigInt(item.quantityMilli, "Количество"),
      unitPriceMinor: parseNonNegativeBigInt(item.unitPriceMinor, "Цена"),
      lineTotalMinor: parseNonNegativeBigInt(item.lineTotalMinor, "Сумма строки")
    };
  });
  if (items.some((item) => item.quantityMilli <= 0n)) {
    throw Object.assign(new Error("Количество товара должно быть больше нуля."), { statusCode: 400 });
  }
  const lineSum = items.reduce((sum, item) => sum + item.lineTotalMinor, 0n);
  if (lineSum !== totalMinor) {
    throw Object.assign(new Error("Сумма строк не совпадает с итогом чека."), { statusCode: 400 });
  }
  return {
    externalReceiptId,
    receiptNumber,
    storeId,
    storeName: input.storeName?.trim().slice(0, 300) || null,
    plumberIdentifier,
    totalMinor,
    purchaseAt,
    source: source as ReceiptSource,
    items
  };
};

const loadReceipt = async (database: Queryable, receiptId: string) => {
  const receipt = await database.query<{
    id: string; external_receipt_id: string; receipt_number: string; store_id: string;
    store_name: string | null; total_minor: string | number; eligible_total_minor: string | number;
    purchase_at: Date | string; source: ReceiptSource; created_at: Date | string;
  }>(
    `SELECT id, external_receipt_id, receipt_number, store_id, store_name, total_minor,
            eligible_total_minor, purchase_at, source, created_at
     FROM app_loyalty_receipts WHERE id = $1`,
    [receiptId]
  );
  const row = receipt.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    externalReceiptId: row.external_receipt_id,
    receiptNumber: row.receipt_number,
    storeId: row.store_id,
    storeName: row.store_name,
    totalMinor: String(row.total_minor),
    eligibleTotalMinor: String(row.eligible_total_minor),
    purchaseAt: new Date(row.purchase_at).toISOString(),
    source: row.source,
    createdAt: new Date(row.created_at).toISOString()
  };
};

export async function ingestReceipt(pool: pg.Pool, input: ReceiptInput, actorId?: string | null) {
  const normalized = normalizeReceipt(input);
  const hash = contentHash(normalized);
  const profile = await getPlumberProfileByPublicIdentifier(pool, normalized.plumberIdentifier);
  if (!profile || profile.applicationStatus !== "approved") {
    throw Object.assign(new Error("Подтверждённый сантехник с таким кодом не найден."), { statusCode: 404 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [normalized.externalReceiptId]);
    const duplicate = await client.query<{ id: string; content_hash: string }>(
      "SELECT id, content_hash FROM app_loyalty_receipts WHERE external_receipt_id = $1 FOR UPDATE",
      [normalized.externalReceiptId]
    );
    if (duplicate.rows[0]) {
      if (duplicate.rows[0].content_hash !== hash) {
        throw Object.assign(new Error("Чек с этим внешним ID уже принят с другим содержимым."), { statusCode: 409 });
      }
      await client.query("COMMIT");
      return { created: false, receipt: await loadReceipt(pool, duplicate.rows[0].id) };
    }

    const config = await getLoyaltyConfig(client);
    const levelBefore = await calculateLevelProgress(client, profile.id, normalized.purchaseAt);
    const rateBps = Math.max(config.baseRateBps, levelBefore.current.bonusRateBps);
    const [promotions, exclusions] = await Promise.all([
      client.query<{ scope_type: "product" | "brand"; scope_value: string; multiplier_bps: number }>(
        `SELECT scope_type, scope_value, multiplier_bps FROM app_loyalty_promotions
         WHERE is_active = true AND starts_at <= $1 AND ends_at >= $1`,
        [normalized.purchaseAt.toISOString()]
      ),
      client.query<{ scope_type: "product" | "brand"; scope_value: string }>(
        "SELECT scope_type, scope_value FROM app_loyalty_exclusions WHERE is_active = true"
      )
    ]);

    const calculatedItems = normalized.items.map((item) => {
      const isExcluded = exclusions.rows.some((rule) =>
        (rule.scope_type === "product" && item.productId === rule.scope_value) ||
        (rule.scope_type === "brand" && item.brand?.toLowerCase() === rule.scope_value.toLowerCase())
      );
      const multiplierBps = promotions.rows.reduce((highest, promotion) => {
        const matches =
          (promotion.scope_type === "product" && item.productId === promotion.scope_value) ||
          (promotion.scope_type === "brand" && item.brand?.toLowerCase() === promotion.scope_value.toLowerCase());
        return matches ? Math.max(highest, promotion.multiplier_bps) : highest;
      }, 10_000);
      const eligibleTotalMinor = isExcluded ? 0n : item.lineTotalMinor;
      const baseBonusMinor = (eligibleTotalMinor * BigInt(rateBps)) / 10_000n;
      const totalBonusMinor = (eligibleTotalMinor * BigInt(rateBps) * BigInt(multiplierBps)) / 100_000_000n;
      return {
        ...item,
        eligibleTotalMinor,
        rateBps,
        multiplierBps,
        baseBonusMinor,
        promoBonusMinor: totalBonusMinor - baseBonusMinor
      };
    });
    const eligibleTotal = calculatedItems.reduce((sum, item) => sum + item.eligibleTotalMinor, 0n);
    const baseBonus = calculatedItems.reduce((sum, item) => sum + item.baseBonusMinor, 0n);
    const promoBonus = calculatedItems.reduce((sum, item) => sum + item.promoBonusMinor, 0n);
    const receiptId = randomUUID();
    const availableAt = new Date(normalized.purchaseAt.getTime() + config.pendingDays * 86_400_000);

    await client.query(
      `INSERT INTO app_loyalty_receipts (
         id, external_receipt_id, content_hash, receipt_number, store_id, store_name,
         plumber_id, total_minor, eligible_total_minor, purchase_at, source, raw_payload, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)`,
      [
        receiptId, normalized.externalReceiptId, hash, normalized.receiptNumber,
        normalized.storeId, normalized.storeName, profile.id, normalized.totalMinor.toString(),
        eligibleTotal.toString(), normalized.purchaseAt.toISOString(), normalized.source,
        JSON.stringify(canonicalize(normalized)), actorId ?? null
      ]
    );
    for (const item of calculatedItems) {
      await client.query(
        `INSERT INTO app_loyalty_receipt_items (
           id, receipt_id, external_line_id, product_id, product_name, brand,
           quantity_milli, unit_price_minor, line_total_minor, eligible_total_minor,
           applied_rate_bps, applied_multiplier_bps, base_bonus_minor, promo_bonus_minor
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          randomUUID(), receiptId, item.externalLineId, item.productId, item.productName, item.brand,
          item.quantityMilli.toString(), item.unitPriceMinor.toString(), item.lineTotalMinor.toString(),
          item.eligibleTotalMinor.toString(), item.rateBps, item.multiplierBps,
          item.baseBonusMinor.toString(), item.promoBonusMinor.toString()
        ]
      );
    }
    const initialStatus = availableAt <= new Date() ? "available" : "pending";
    const initialBucket = initialStatus === "available" ? "available" : "pending";
    if (baseBonus > 0n) {
      await client.query(
        `INSERT INTO app_loyalty_transactions (
           id, plumber_id, transaction_type, status, balance_bucket, amount_minor,
           description, receipt_id, available_at, created_by
         ) VALUES ($1, $2, 'purchase_accrual', $3, $4, $5, $6, $7, $8, $9)`,
        [randomUUID(), profile.id, initialStatus, initialBucket, baseBonus.toString(), `Начисление по чеку №${normalized.receiptNumber}`, receiptId, availableAt.toISOString(), actorId ?? null]
      );
    }
    if (promoBonus > 0n) {
      await client.query(
        `INSERT INTO app_loyalty_transactions (
           id, plumber_id, transaction_type, status, balance_bucket, amount_minor,
           description, receipt_id, available_at, created_by
         ) VALUES ($1, $2, 'promotional_multiplier', $3, $4, $5, $6, $7, $8, $9)`,
        [randomUUID(), profile.id, initialStatus, initialBucket, promoBonus.toString(), `Промо-бонус по чеку №${normalized.receiptNumber}`, receiptId, availableAt.toISOString(), actorId ?? null]
      );
    }
    if (actorId) {
      await client.query(
        `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'receipt.ingested', 'receipt', $3, $4::jsonb)`,
        [randomUUID(), actorId, receiptId, JSON.stringify({ source: normalized.source, externalReceiptId: normalized.externalReceiptId })]
      );
    }
    await enqueueNotification(client, {
      recipientAccountId: profile.accountId ?? undefined,
      eventType: "loyalty.receipt_processed",
      dedupeKey: `receipt:${receiptId}:processed`,
      text: `Покупка №${normalized.receiptNumber} учтена. Начислено ${Number(baseBonus + promoBonus) / 100} бонуса; статус: ${initialStatus === "pending" ? `ожидает ${config.pendingDays} дней` : "доступно"}.`
    });
    const levelAfter = await calculateLevelProgress(client, profile.id, normalized.purchaseAt);
    if (levelAfter.current.code !== levelBefore.current.code) {
      await enqueueNotification(client, {
        recipientAccountId: profile.accountId ?? undefined,
        eventType: "loyalty.level_changed",
        dedupeKey: `receipt:${receiptId}:level:${levelAfter.current.code}`,
        text: `Ваш новый уровень в программе Авантехник — ${levelAfter.current.name}.`
      });
    }
    await client.query("COMMIT");
    return { created: true, receipt: await loadReceipt(pool, receiptId) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function releasePendingBonuses(pool: pg.Pool, plumberId?: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const released = await client.query<{ id: string; plumber_id: string; amount_minor: string | number }>(
      `WITH due AS (
         SELECT id FROM app_loyalty_transactions
         WHERE status = 'pending' AND available_at <= now()
           AND ($1::text IS NULL OR plumber_id = $1)
         ORDER BY available_at ASC FOR UPDATE SKIP LOCKED LIMIT 500
       )
       UPDATE app_loyalty_transactions transactions
       SET status = 'available', balance_bucket = 'available'
       FROM due WHERE transactions.id = due.id
       RETURNING transactions.id, transactions.plumber_id, transactions.amount_minor`,
      [plumberId ?? null]
    );
    if (released.rows.length) {
      await client.query(
        `UPDATE app_loyalty_transactions reversals
         SET balance_bucket = 'available'
         WHERE reversals.status = 'reversed'
           AND reversals.source_transaction_id = ANY($1::text[])`,
        [released.rows.map((row) => row.id)]
      );
      const grouped = new Map<string, bigint>();
      for (const row of released.rows) grouped.set(row.plumber_id, (grouped.get(row.plumber_id) ?? 0n) + BigInt(String(row.amount_minor)));
      for (const [id, amount] of grouped) {
        const account = await client.query<{ account_id: string }>("SELECT account_id FROM app_plumber_profiles WHERE id = $1", [id]);
        if (account.rows[0]) {
          await enqueueNotification(client, {
            recipientAccountId: account.rows[0].account_id,
            eventType: "loyalty.pending_released",
            dedupeKey: `loyalty:released:${released.rows.filter((row) => row.plumber_id === id).map((row) => row.id).sort().join(",")}`,
            text: `${Number(amount) / 100} бонуса переведено из ожидания в доступный баланс.`
          });
        }
      }
    }
    await client.query("COMMIT");
    return released.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const normalizeReturn = (input: ReturnInput) => {
  const externalReturnId = requiredText(input.externalReturnId, "ID возврата", 200);
  const externalReceiptId = requiredText(input.externalReceiptId, "ID чека", 200);
  const returnAt = parseDate(input.returnAt, "Дата возврата");
  const source = ["pos", "1c", "manual", "fixture"].includes(input.source) ? input.source as ReceiptSource : null;
  if (!source) throw Object.assign(new Error("Неизвестный источник возврата."), { statusCode: 400 });
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 200) {
    throw Object.assign(new Error("Возврат должен содержать позиции."), { statusCode: 400 });
  }
  const items = input.items.map((item) => ({
    externalLineId: requiredText(item.externalLineId, "ID строки", 100),
    quantityMilli: parseNonNegativeBigInt(item.quantityMilli, "Количество возврата"),
    amountMinor: parseNonNegativeBigInt(item.amountMinor, "Сумма возврата")
  }));
  if (items.some((item) => item.quantityMilli <= 0n)) throw Object.assign(new Error("Количество возврата должно быть больше нуля."), { statusCode: 400 });
  return { externalReturnId, externalReceiptId, returnAt, source, items };
};

export async function ingestReturn(pool: pg.Pool, input: ReturnInput, actorId?: string | null) {
  const normalized = normalizeReturn(input);
  const hash = contentHash(normalized);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [normalized.externalReturnId]);
    const duplicate = await client.query<{ id: string; content_hash: string }>(
      "SELECT id, content_hash FROM app_loyalty_returns WHERE external_return_id = $1 FOR UPDATE",
      [normalized.externalReturnId]
    );
    if (duplicate.rows[0]) {
      if (duplicate.rows[0].content_hash !== hash) throw Object.assign(new Error("Возврат с этим ID уже принят с другим содержимым."), { statusCode: 409 });
      await client.query("COMMIT");
      return { created: false, returnId: duplicate.rows[0].id };
    }
    const receipt = await client.query<{ id: string; plumber_id: string; receipt_number: string; account_id: string }>(
      `SELECT receipts.id, receipts.plumber_id, receipts.receipt_number, plumbers.account_id
       FROM app_loyalty_receipts receipts
       JOIN app_plumber_profiles plumbers ON plumbers.id = receipts.plumber_id
       WHERE receipts.external_receipt_id = $1 FOR UPDATE OF receipts`,
      [normalized.externalReceiptId]
    );
    if (!receipt.rows[0]) throw Object.assign(new Error("Исходный чек не найден."), { statusCode: 404 });
    const returnId = randomUUID();
    await client.query(
      `INSERT INTO app_loyalty_returns (
         id, external_return_id, content_hash, receipt_id, return_at, source, raw_payload, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [returnId, normalized.externalReturnId, hash, receipt.rows[0].id, normalized.returnAt.toISOString(), normalized.source, JSON.stringify(canonicalize(normalized)), actorId ?? null]
    );

    let reverseBase = 0n;
    let reversePromo = 0n;
    for (const item of normalized.items) {
      const selected = await client.query<{
        id: string; quantity_milli: string | number; line_total_minor: string | number; eligible_total_minor: string | number;
        returned_quantity_milli: string | number; returned_amount_minor: string | number;
        base_bonus_minor: string | number; promo_bonus_minor: string | number;
        reversed_base_bonus_minor: string | number; reversed_promo_bonus_minor: string | number;
      }>(
        `SELECT id, quantity_milli, line_total_minor, eligible_total_minor, returned_quantity_milli, returned_amount_minor,
                base_bonus_minor, promo_bonus_minor, reversed_base_bonus_minor, reversed_promo_bonus_minor
         FROM app_loyalty_receipt_items
         WHERE receipt_id = $1 AND external_line_id = $2 FOR UPDATE`,
        [receipt.rows[0].id, item.externalLineId]
      );
      const row = selected.rows[0];
      if (!row) throw Object.assign(new Error(`Строка возврата ${item.externalLineId} не найдена в чеке.`), { statusCode: 400 });
      const newQuantity = BigInt(String(row.returned_quantity_milli)) + item.quantityMilli;
      const newAmount = BigInt(String(row.returned_amount_minor)) + item.amountMinor;
      const eligible = BigInt(String(row.eligible_total_minor));
      if (newQuantity > BigInt(String(row.quantity_milli)) || newAmount > BigInt(String(row.line_total_minor))) {
        throw Object.assign(new Error(`Возврат по строке ${item.externalLineId} превышает покупку.`), { statusCode: 409 });
      }
      const targetBase = eligible > 0n ? (BigInt(String(row.base_bonus_minor)) * newAmount) / eligible : 0n;
      const targetPromo = eligible > 0n ? (BigInt(String(row.promo_bonus_minor)) * newAmount) / eligible : 0n;
      const baseDelta = targetBase - BigInt(String(row.reversed_base_bonus_minor));
      const promoDelta = targetPromo - BigInt(String(row.reversed_promo_bonus_minor));
      reverseBase += baseDelta;
      reversePromo += promoDelta;
      await client.query(
        `UPDATE app_loyalty_receipt_items
         SET returned_quantity_milli = $1, returned_amount_minor = $2,
             reversed_base_bonus_minor = $3, reversed_promo_bonus_minor = $4
         WHERE id = $5`,
        [newQuantity.toString(), newAmount.toString(), targetBase.toString(), targetPromo.toString(), row.id]
      );
      await client.query(
        `INSERT INTO app_loyalty_return_items (
           id, return_id, receipt_item_id, quantity_milli, amount_minor,
           base_bonus_reversed_minor, promo_bonus_reversed_minor
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), returnId, row.id, item.quantityMilli.toString(), item.amountMinor.toString(), baseDelta.toString(), promoDelta.toString()]
      );
    }

    for (const component of [
      { type: "purchase_accrual", amount: reverseBase },
      { type: "promotional_multiplier", amount: reversePromo }
    ]) {
      if (component.amount <= 0n) continue;
      const source = await client.query<{ id: string; status: string; balance_bucket: string }>(
        `SELECT id, status, balance_bucket FROM app_loyalty_transactions
         WHERE receipt_id = $1 AND transaction_type = $2 ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
        [receipt.rows[0].id, component.type]
      );
      if (!source.rows[0]) throw new Error("Исходное начисление для возврата не найдено.");
      await client.query(
        `INSERT INTO app_loyalty_transactions (
           id, plumber_id, transaction_type, status, balance_bucket, amount_minor,
           description, receipt_id, return_id, source_transaction_id, created_by
         ) VALUES ($1, $2, 'return_reversal', 'reversed', $3, $4, $5, $6, $7, $8, $9)`,
        [randomUUID(), receipt.rows[0].plumber_id, source.rows[0].balance_bucket, (-component.amount).toString(), `Возврат по чеку №${receipt.rows[0].receipt_number}`, receipt.rows[0].id, returnId, source.rows[0].id, actorId ?? null]
      );
    }
    if (actorId) {
      await client.query(
        `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'receipt.return_ingested', 'return', $3, $4::jsonb)`,
        [randomUUID(), actorId, returnId, JSON.stringify({ externalReturnId: normalized.externalReturnId, externalReceiptId: normalized.externalReceiptId })]
      );
    }
    await enqueueNotification(client, {
      recipientAccountId: receipt.rows[0].account_id,
      eventType: "loyalty.return_processed",
      dedupeKey: `return:${returnId}:processed`,
      text: `Возврат по чеку №${receipt.rows[0].receipt_number} обработан. Списано ${Number(reverseBase + reversePromo) / 100} бонуса.`
    });
    await client.query("COMMIT");
    return { created: true, returnId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLoyaltyBalances(database: Queryable, plumberId: string) {
  const result = await database.query<{
    pending_minor: string | number; available_minor: string | number;
    spent_minor: string | number; reversed_minor: string | number;
  }>(
    `SELECT
       COALESCE(SUM(amount_minor) FILTER (WHERE balance_bucket = 'pending' AND status IN ('pending', 'reversed')), 0) AS pending_minor,
       COALESCE(SUM(amount_minor) FILTER (WHERE balance_bucket = 'available' AND status IN ('available', 'spent', 'reversed')), 0) AS available_minor,
       COALESCE(-SUM(amount_minor) FILTER (WHERE status = 'spent'), 0) AS spent_minor,
       COALESCE(-SUM(amount_minor) FILTER (WHERE status = 'reversed'), 0) AS reversed_minor
     FROM app_loyalty_transactions WHERE plumber_id = $1`,
    [plumberId]
  );
  const row = result.rows[0];
  return {
    pendingMinor: String(row?.pending_minor ?? 0),
    availableMinor: String(row?.available_minor ?? 0),
    spentMinor: String(row?.spent_minor ?? 0),
    reversedMinor: String(row?.reversed_minor ?? 0)
  };
}

export async function listLoyaltyTransactions(
  pool: pg.Pool,
  accountId: string,
  filters: { status?: string; type?: string; limit?: number; offset?: number } = {}
) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  const result = await pool.query<{
    id: string; transaction_type: string; status: string; balance_bucket: string;
    amount_minor: string | number; description: string; available_at: Date | string | null;
    created_at: Date | string; receipt_number: string | null;
  }>(
    `SELECT transactions.id, transactions.transaction_type, transactions.status,
            transactions.balance_bucket, transactions.amount_minor, transactions.description,
            transactions.available_at, transactions.created_at, receipts.receipt_number
     FROM app_loyalty_transactions transactions
     LEFT JOIN app_loyalty_receipts receipts ON receipts.id = transactions.receipt_id
     WHERE transactions.plumber_id = $1
       AND ($2::text IS NULL OR transactions.status = $2)
       AND ($3::text IS NULL OR transactions.transaction_type = $3)
     ORDER BY transactions.created_at DESC
     LIMIT $4 OFFSET $5`,
    [plumber.id, filters.status ?? null, filters.type ?? null, Math.min(Math.max(filters.limit ?? 30, 1), 100), Math.max(filters.offset ?? 0, 0)]
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.transaction_type,
    status: row.status,
    balanceBucket: row.balance_bucket,
    amountMinor: String(row.amount_minor),
    description: row.description,
    receiptNumber: row.receipt_number,
    availableAt: row.available_at ? new Date(row.available_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString()
  }));
}

export async function getPlumberDashboard(pool: pg.Pool, accountId: string) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  await releasePendingBonuses(pool, plumber.id);
  const [balances, level, receipts, activeReservations, newLeads, promotions] = await Promise.all([
    getLoyaltyBalances(pool, plumber.id),
    calculateLevelProgress(pool, plumber.id),
    pool.query<{ id: string; receipt_number: string; store_name: string | null; total_minor: string | number; purchase_at: Date | string }>(
      `SELECT id, receipt_number, store_name, total_minor, purchase_at
       FROM app_loyalty_receipts WHERE plumber_id = $1 ORDER BY purchase_at DESC LIMIT 5`,
      [plumber.id]
    ),
    pool.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM app_orders
       WHERE customer_id = $1 AND order_kind = 'reservation'
         AND status IN ('created', 'confirmed', 'assembling', 'ready_for_pickup')`,
      [accountId]
    ),
    pool.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM app_service_requests
       WHERE assigned_plumber_id = $1 AND status IN ('new', 'viewed') AND expires_at > now()`,
      [plumber.id]
    ),
    pool.query<{ id: string; title: string; description: string; image_url: string | null; multiplier_bps: number; ends_at: Date | string }>(
      `SELECT id, title, COALESCE(description, '') AS description, image_url, multiplier_bps, ends_at
       FROM app_loyalty_promotions
       WHERE is_active = true AND starts_at <= now() AND ends_at >= now()
       ORDER BY ends_at ASC LIMIT 5`
    )
  ]);
  return {
    plumber,
    qr: { payload: `AVANT:PLUMBER:${plumber.publicId}`, loyaltyCode: plumber.loyaltyCode },
    balances,
    level,
    recentPurchases: receipts.rows.map((row) => ({
      id: row.id,
      receiptNumber: row.receipt_number,
      storeName: row.store_name,
      totalMinor: String(row.total_minor),
      purchaseAt: new Date(row.purchase_at).toISOString()
    })),
    activeReservationsCount: Number(activeReservations.rows[0]?.count ?? 0),
    newLeadsCount: Number(newLeads.rows[0]?.count ?? 0),
    promotions: promotions.rows.map((row) => ({
      id: row.id, title: row.title, description: row.description, imageUrl: row.image_url,
      multiplier: row.multiplier_bps / 10_000, endsAt: new Date(row.ends_at).toISOString()
    }))
  };
}

export async function createManualAdjustment(
  pool: pg.Pool,
  actorId: string,
  plumberId: string,
  amountMinorValue: string | number,
  reasonValue: string
) {
  const amount = parseSignedBigInt(amountMinorValue, "Сумма корректировки");
  const reason = requiredText(reasonValue, "Причина", 1_000);
  if (amount === 0n || reason.length < 5) throw Object.assign(new Error("Укажите ненулевую сумму и подробную причину."), { statusCode: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profile = await client.query<{ account_id: string; application_status: string }>(
      "SELECT account_id, application_status FROM app_plumber_profiles WHERE id = $1 FOR UPDATE",
      [plumberId]
    );
    if (!profile.rows[0]) throw Object.assign(new Error("Сантехник не найден."), { statusCode: 404 });
    if (profile.rows[0].application_status !== "approved") throw Object.assign(new Error("Анкета сантехника не подтверждена."), { statusCode: 409 });
    const id = randomUUID();
    await client.query(
      `INSERT INTO app_loyalty_transactions (
         id, plumber_id, transaction_type, status, balance_bucket, amount_minor,
         description, metadata, created_by
       ) VALUES ($1, $2, 'manual_adjustment', 'available', 'available', $3, $4, $5::jsonb, $6)`,
      [id, plumberId, amount.toString(), `Ручная корректировка: ${reason}`, JSON.stringify({ reason }), actorId]
    );
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, reason, metadata)
       VALUES ($1, $2, 'loyalty.manual_adjustment', 'loyalty_transaction', $3, $4, $5::jsonb)`,
      [randomUUID(), actorId, id, reason, JSON.stringify({ amountMinor: amount.toString(), plumberId })]
    );
    await enqueueNotification(client, {
      recipientAccountId: profile.rows[0].account_id,
      eventType: "loyalty.manual_adjustment",
      dedupeKey: `loyalty:adjustment:${id}`,
      text: `Баланс программы лояльности скорректирован на ${Number(amount) / 100} бонуса. Причина: ${reason}`
    });
    await client.query("COMMIT");
    return { id, amountMinor: amount.toString() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateLoyaltyConfiguration(
  pool: pg.Pool,
  actorId: string,
  payload: { baseRateBps: number; pendingDays: number; rollingPeriodDays: number; levels?: Array<{ id: string; thresholdMinor: string | number; bonusRateBps: number }> }
) {
  const baseRate = Math.floor(payload.baseRateBps);
  const pendingDays = Math.floor(payload.pendingDays);
  const rollingDays = Math.floor(payload.rollingPeriodDays);
  if (baseRate < 0 || baseRate > 10_000 || pendingDays < 0 || pendingDays > 365 || rollingDays < 1 || rollingDays > 730) {
    throw Object.assign(new Error("Проверьте настройки программы."), { statusCode: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE app_loyalty_config SET base_rate_bps = $1, pending_days = $2,
       rolling_period_days = $3, updated_by = $4, updated_at = now() WHERE id = 1`,
      [baseRate, pendingDays, rollingDays, actorId]
    );
    for (const level of payload.levels ?? []) {
      const threshold = parseNonNegativeBigInt(level.thresholdMinor, "Порог уровня");
      const rate = Math.floor(level.bonusRateBps);
      if (rate < 0 || rate > 10_000) throw Object.assign(new Error("Проверьте ставку уровня."), { statusCode: 400 });
      const updated = await client.query(
        `UPDATE app_loyalty_levels SET threshold_minor = $1, bonus_rate_bps = $2,
         updated_by = $3, updated_at = now() WHERE id = $4`,
        [threshold.toString(), rate, actorId, level.id]
      );
      if (!updated.rowCount) throw Object.assign(new Error("Уровень не найден."), { statusCode: 404 });
    }
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'loyalty.config_updated', 'loyalty_config', '1', $3::jsonb)`,
      [randomUUID(), actorId, JSON.stringify({ baseRateBps: baseRate, pendingDays, rollingPeriodDays: rollingDays, levels: payload.levels ?? [] })]
    );
    await client.query("COMMIT");
    return getLoyaltyConfig(pool);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listRewards(pool: pg.Pool, accountId: string) {
  await requireApprovedPlumber(pool, accountId);
  const result = await pool.query<{
    id: string; title: string; image_url: string | null; description: string;
    cost_minor: string | number; availability_count: number | null; conditions: string | null;
  }>(
    `SELECT id, title, image_url, description, cost_minor, availability_count, conditions
     FROM app_rewards WHERE is_active = true AND (availability_count IS NULL OR availability_count > 0)
     ORDER BY cost_minor ASC, created_at DESC`
  );
  return result.rows.map((row) => ({
    id: row.id, title: row.title, imageUrl: row.image_url, description: row.description,
    costMinor: String(row.cost_minor), availabilityCount: row.availability_count, conditions: row.conditions
  }));
}

export async function redeemReward(pool: pg.Pool, accountId: string, rewardId: string, clientRequestId: string) {
  const plumber = await requireApprovedPlumber(pool, accountId);
  const requestId = requiredText(clientRequestId, "ID операции", 100);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM app_plumber_profiles WHERE id = $1 FOR UPDATE", [plumber.id]);
    const duplicate = await client.query<{ id: string; status: string; cost_minor: string | number }>(
      "SELECT id, status, cost_minor FROM app_reward_redemptions WHERE plumber_id = $1 AND client_request_id = $2",
      [plumber.id, requestId]
    );
    if (duplicate.rows[0]) {
      await client.query("COMMIT");
      return { created: false, id: duplicate.rows[0].id, status: duplicate.rows[0].status, costMinor: String(duplicate.rows[0].cost_minor) };
    }
    const reward = await client.query<{ title: string; cost_minor: string | number; availability_count: number | null; is_active: boolean }>(
      "SELECT title, cost_minor, availability_count, is_active FROM app_rewards WHERE id = $1 FOR UPDATE",
      [rewardId]
    );
    const item = reward.rows[0];
    if (!item || !item.is_active || item.availability_count === 0) throw Object.assign(new Error("Награда сейчас недоступна."), { statusCode: 409 });
    const balance = await getLoyaltyBalances(client, plumber.id);
    const cost = BigInt(String(item.cost_minor));
    if (BigInt(balance.availableMinor) < cost) throw Object.assign(new Error("Недостаточно доступных бонусов."), { statusCode: 409 });
    const id = randomUUID();
    await client.query(
      `INSERT INTO app_reward_redemptions (id, plumber_id, reward_id, client_request_id, cost_minor)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, plumber.id, rewardId, requestId, cost.toString()]
    );
    await client.query(
      `INSERT INTO app_loyalty_transactions (
         id, plumber_id, transaction_type, status, balance_bucket, amount_minor,
         description, reward_redemption_id
       ) VALUES ($1, $2, 'reward_redemption', 'spent', 'available', $3, $4, $5)`,
      [randomUUID(), plumber.id, (-cost).toString(), `Обмен бонусов: ${item.title}`, id]
    );
    if (item.availability_count !== null) await client.query("UPDATE app_rewards SET availability_count = availability_count - 1 WHERE id = $1", [rewardId]);
    await enqueueNotification(client, {
      recipientAccountId: accountId,
      eventType: "loyalty.reward_redemption",
      dedupeKey: `reward:redemption:${id}:pending`,
      text: `Заявка на награду «${item.title}» принята и ожидает обработки.`
    });
    await client.query("COMMIT");
    return { created: true, id, status: "pending", costMinor: cost.toString() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function processRewardRedemption(
  pool: pg.Pool,
  actorId: string,
  redemptionId: string,
  nextStatus: "approved" | "fulfilled" | "cancelled",
  note?: string | null
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      status: string; plumber_id: string; reward_id: string; account_id: string; title: string;
    }>(
      `SELECT redemptions.status, redemptions.plumber_id, redemptions.reward_id,
              plumbers.account_id, rewards.title
       FROM app_reward_redemptions redemptions
       JOIN app_plumber_profiles plumbers ON plumbers.id = redemptions.plumber_id
       JOIN app_rewards rewards ON rewards.id = redemptions.reward_id
       WHERE redemptions.id = $1 FOR UPDATE OF redemptions`,
      [redemptionId]
    );
    const row = current.rows[0];
    if (!row) throw Object.assign(new Error("Заявка на награду не найдена."), { statusCode: 404 });
    if (row.status === nextStatus) {
      await client.query("COMMIT");
      return { changed: false, status: row.status };
    }
    const allowed: Record<string, string[]> = { pending: ["approved", "cancelled"], approved: ["fulfilled", "cancelled"] };
    if (!allowed[row.status]?.includes(nextStatus)) throw Object.assign(new Error("Этот переход статуса недоступен."), { statusCode: 409 });
    await client.query(
      `UPDATE app_reward_redemptions SET status = $1, processed_by = $2,
       processing_note = $3, updated_at = now() WHERE id = $4`,
      [nextStatus, actorId, note?.trim().slice(0, 1_000) || null, redemptionId]
    );
    if (nextStatus === "cancelled") {
      await client.query(
        `UPDATE app_loyalty_transactions SET status = 'cancelled', balance_bucket = 'none'
         WHERE reward_redemption_id = $1 AND transaction_type = 'reward_redemption'`,
        [redemptionId]
      );
      await client.query("UPDATE app_rewards SET availability_count = availability_count + 1 WHERE id = $1 AND availability_count IS NOT NULL", [row.reward_id]);
    }
    await client.query(
      `INSERT INTO app_admin_audit_log (id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'reward.status_changed', 'reward_redemption', $3, $4::jsonb)`,
      [randomUUID(), actorId, redemptionId, JSON.stringify({ previousStatus: row.status, nextStatus })]
    );
    await enqueueNotification(client, {
      recipientAccountId: row.account_id,
      eventType: "loyalty.reward_status",
      dedupeKey: `reward:redemption:${redemptionId}:${nextStatus}`,
      text: `Статус награды «${row.title}»: ${nextStatus === "approved" ? "подтверждена" : nextStatus === "fulfilled" ? "выдана" : "отменена"}.`
    });
    await client.query("COMMIT");
    return { changed: true, status: nextStatus };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
