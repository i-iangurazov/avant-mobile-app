import {mediaProvider,uploadMedia,requireOwnedMedia} from "./server/media";
import { listPublicDocuments } from "./server/documents";
import { deleteAccount } from "./server/deletion";
import { trustedOrder, trustedTotal } from "./server/order-trust";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import {
  bearerToken,
  getCustomerProfile,
  hasAdminAccess,
  loginCustomer,
  registerCustomer,
  updateCustomerProfile,
  requireSession, refreshSession, revokeSession, resetPassword, normalizePhone
} from "./server/auth";
import { createPhoneChallenge, httpSmsSender, rateLimit, type PhoneAction } from "./server/security";
import { createPool, ensureSchema } from "./server/db";
import { loadEnv } from "./server/env";
import {
  claimTelegramDeliveries,
  createAppOrder,
  getAppOrder,
  listAppOrders,
  markTelegramFailed,
  markTelegramSent,
  ORDER_STATUS_LABELS,
  updateAppOrderStatus,
  type NewOrder,
  type NewOrderItem
} from "./server/orders";
import {
  applyForPlumber,
  getPlumberProfileByAccount,
  listPlumberApplications,
  plumberQrPayload,
  requireApprovedPlumber,
  updatePlumberApplicationStatus,
  type PlumberApplicationInput,
  type PlumberApplicationStatus
} from "./server/plumbers";
import {
  createManualAdjustment,
  getLoyaltyConfig,
  getPlumberDashboard,
  ingestReceipt,
  ingestReturn,
  listLoyaltyTransactions,
  listRewards,
  processRewardRedemption,
  redeemReward,
  releasePendingBonuses,
  updateLoyaltyConfiguration,
  type ReceiptInput,
  type ReturnInput
} from "./server/loyalty";
import {
  assignServiceRequest,
  cancelCustomerServiceRequest,
  createLeadReview,
  createServiceRequest,
  listAdminServiceRequests,
  listCustomerServiceRequests,
  listLeadCandidates,
  listPlumberLeads,
  listPlumberReviews,
  markLeadViewed,
  moderateReview,
  updateLeadByPlumber,
  type ServiceRequestInput
} from "./server/leads";
import {
  consumeTelegramLinkToken,
  createTelegramLinkToken,
  deliverNotificationOutbox,
  enqueueNotification,
  getTelegramLinkStatus,
  updateTelegramPreferences
} from "./server/notifications";
import {
  getAdminProgramOverview,
  listProgramContent,
  registerForTraining,
  setLoyaltyExclusion,
  upsertLoyaltyPromotion,
  upsertProgramContent,
  upsertReward
} from "./server/program-content";
import {
  answerTelegramCallback,
  editTelegramOrder,
  isTelegramChatAdmin,
  parseOrderStatusCallback,
  registerTelegramWebhook,
  resolveTelegramWebhookUrl,
  sendTelegramText,
  sendOrderToTelegram,
  telegramWebhookSecret
} from "./server/telegram";

const env = loadEnv();
const port = Number(env.PORT || env.APP_SERVER_PORT || env.BAZAAR_PROXY_PORT || 8787);
const host = env.APP_SERVER_HOST || env.BAZAAR_PROXY_HOST || "0.0.0.0";
const databaseUrl = env.DATABASE_URL || "";
const configuredAuthSecret =
  env.AUTH_TOKEN_SECRET && !env.AUTH_TOKEN_SECRET.startsWith("replace_with") ? env.AUTH_TOKEN_SECRET : "";
const authTokenSecret = configuredAuthSecret || "avantehnik-local-dev-secret";
const telegramConfig = {
  botToken: env.TELEGRAM_BOT_TOKEN || "",
  chatId: env.TELEGRAM_CHAT_ID || ""
};
const telegramConfigured = Boolean(telegramConfig.botToken && telegramConfig.chatId);
const telegramBotUsername = (env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim();
const adminPhoneNumbers = (env.ADMIN_PHONE_NUMBERS || "").split(",").map((phone) => phone.trim()).filter(Boolean);
const webhookUrl = resolveTelegramWebhookUrl(env.TELEGRAM_WEBHOOK_URL || "", env.RAILWAY_PUBLIC_DOMAIN || "");
const webhookSecret = telegramConfigured
  ? env.TELEGRAM_WEBHOOK_SECRET || telegramWebhookSecret(telegramConfig.botToken, authTokenSecret)
  : "";
const catalogBaseUrl = (env.BAZAAR_API_BASE_URL || "").replace(/\/+$/, "");
const catalogToken = env.BAZAAR_API_TOKEN || "";
const databasePool = createPool(databaseUrl);
const shouldLog = env.NODE_ENV !== "production";

const catalogPaths = ["/products", "/categories"];
const blockedPathParts = [
  "stock",
  "warehouse",
  "inventory",
  "adjust",
  "correction",
  "oprihod",
  "приход",
  "коррект",
  "склад"
];

const getCorsHeaders = (req: IncomingMessage) => ({
  "Access-Control-Allow-Origin": req.headers.origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Access-Control-Request-Private-Network",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin, Access-Control-Request-Private-Network"
});

const sendJson = (req: IncomingMessage, res: ServerResponse, status: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...getCorsHeaders(req),
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
};

const readBody = (req: IncomingMessage, maxBytes = 256 * 1024) =>
  new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;

    req.on("data", (chunk) => {
      if (tooLarge) {
        return;
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        tooLarge = true;
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("Запрос слишком большой."), { statusCode: 413 }));
        return;
      }
      resolveBody(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });

const readJsonBody = async (req: IncomingMessage, maxBytes?:number) => {
  const body = await readBody(req,maxBytes);
  if (!body.length) {
    return {};
  }

  try {
    return JSON.parse(body.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error("Некорректный JSON запрос."), { statusCode: 400 });
  }
};

const requireDatabase = () => {
  if (!databasePool) {
    throw Object.assign(new Error("App database is not configured. Set DATABASE_URL."), { statusCode: 503 });
  }
  return databasePool;
};

const requireCustomerId = (req: IncomingMessage) => requireSession(requireDatabase(), bearerToken(req.headers.authorization), authTokenSecret);

const requireAdminId = async (req: IncomingMessage) => {
  const pool = requireDatabase();
  const accountId = await requireCustomerId(req);
  if (!await hasAdminAccess(pool, accountId, adminPhoneNumbers)) {
    throw Object.assign(new Error("Недостаточно прав администратора."), { statusCode: 403 });
  }
  return accountId;
};

const enforceRateLimit = (req: IncomingMessage, scope: string, limit: number, windowMs = 60_000) =>
  rateLimit(requireDatabase(), scope, req.socket.remoteAddress || 'unknown', limit, windowMs);

const sendError = (req: IncomingMessage, res: ServerResponse, error: unknown) => {
  const status =
    typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  const message = error instanceof Error ? error.message : "Сервис временно недоступен. Попробуйте позже.";
  sendJson(req, res, status, { error: status >= 500 ? "Сервис временно недоступен. Попробуйте позже." : message, requestNotCreated: Boolean(error && typeof error === "object" && "requestNotCreated" in error && error.requestNotCreated) });
};

const asText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const asNullableText = (value: unknown, maxLength: number) => asText(value, maxLength) || null;

const asBoolean = (value: unknown) => value === true;
const asNumber = (value: unknown, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asStringArray = (value: unknown, maxItems = 20) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, maxItems)
    : [];
const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const parsePhoneProof = (value: unknown) => {
  const proof = asRecord(value);
  return { challengeId: asText(proof.challengeId, 100), code: asText(proof.code, 10) };
};

const parsePlumberApplication = (payload: Record<string, unknown>): PlumberApplicationInput => ({
  programDocumentVersion: asText(payload.programDocumentVersion,100),
  privacyDocumentVersion: asText(payload.privacyDocumentVersion,100),
  fullName: asText(payload.fullName, 200),
  city: asText(payload.city, 100),
  workingDistricts: asStringArray(payload.workingDistricts, 12),
  specializations: asStringArray(payload.specializations, 16),
  experienceYears: asNumber(payload.experienceYears),
  profilePhotoUrl: asNullableText(payload.profilePhotoUrl, 500),
  description: asNullableText(payload.description, 1_000),
  programConsent: asBoolean(payload.programConsent),
  dataProcessingConsent: asBoolean(payload.dataProcessingConsent)
});

const parseReceiptInput = (payload: Record<string, unknown>): ReceiptInput => ({
  externalReceiptId: asText(payload.externalReceiptId, 200),
  receiptNumber: asText(payload.receiptNumber, 100),
  storeId: asText(payload.storeId, 100),
  storeName: asNullableText(payload.storeName, 300),
  plumberIdentifier: asText(payload.plumberIdentifier, 200),
  totalMinor: typeof payload.totalMinor === "number" || typeof payload.totalMinor === "string" ? payload.totalMinor : "",
  purchaseAt: asText(payload.purchaseAt, 100),
  source: ["pos", "1c", "fixture"].includes(String(payload.source)) ? payload.source as ReceiptInput["source"] : "manual",
  items: Array.isArray(payload.items) ? payload.items.map((value) => {
    const item = asRecord(value);
    return {
      externalLineId: asText(item.externalLineId, 100),
      productId: asNullableText(item.productId, 200),
      productName: asText(item.productName, 300),
      brand: asNullableText(item.brand, 200),
      quantityMilli: typeof item.quantityMilli === "number" || typeof item.quantityMilli === "string" ? item.quantityMilli : "",
      unitPriceMinor: typeof item.unitPriceMinor === "number" || typeof item.unitPriceMinor === "string" ? item.unitPriceMinor : "",
      lineTotalMinor: typeof item.lineTotalMinor === "number" || typeof item.lineTotalMinor === "string" ? item.lineTotalMinor : ""
    };
  }) : []
});

const parseReturnInput = (payload: Record<string, unknown>): ReturnInput => ({
  externalReturnId: asText(payload.externalReturnId, 200),
  externalReceiptId: asText(payload.externalReceiptId, 200),
  returnAt: asText(payload.returnAt, 100),
  source: ["pos", "1c", "fixture"].includes(String(payload.source)) ? payload.source as ReturnInput["source"] : "manual",
  items: Array.isArray(payload.items) ? payload.items.map((value) => {
    const item = asRecord(value);
    return {
      externalLineId: asText(item.externalLineId, 100),
      quantityMilli: typeof item.quantityMilli === "number" || typeof item.quantityMilli === "string" ? item.quantityMilli : "",
      amountMinor: typeof item.amountMinor === "number" || typeof item.amountMinor === "string" ? item.amountMinor : ""
    };
  }) : []
});

const parseOrderItem = (value: unknown): NewOrderItem | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const item = value as Record<string, unknown>;
  const productName = asText(item.productName, 300);
  const quantity = Number(item.quantity);
  const rawPrice = item.unitPrice;
  const parsedPrice = rawPrice === null || rawPrice === undefined || rawPrice === "" ? null : Number(rawPrice);
  const unitPrice = parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0 && parsedPrice <= 100_000_000
    ? parsedPrice
    : null;

  if (!productName || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
    return null;
  }

  return {
    productId: asNullableText(item.productId, 200),
    productName,
    quantity,
    unitPrice,
    unitPriceLabel: asNullableText(item.unitPriceLabel, 100)
  };
};

const parseNewOrder = (payload: Record<string, unknown>): NewOrder => {
  if (['discount','discountAmount','discountPercent','bonus','bonusAmount','total','totalAmount','organizationId'].some(key => key in payload)) {
    throw Object.assign(new Error('Суммы, скидки и организация определяются сервером.'), {statusCode:400});
  }
  const clientRequestId = asText(payload.clientRequestId, 100);
  const customerName = asText(payload.customerName, 200);
  const customerPhone = asText(payload.customerPhone, 40);
  const deliveryMethod = payload.deliveryMethod === "delivery" ? "delivery" : payload.deliveryMethod === "pickup" ? "pickup" : null;
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems.map(parseOrderItem).filter((item): item is NewOrderItem => Boolean(item));
  const deliveryAddress = asNullableText(payload.deliveryAddress, 500);
  const storeId = asNullableText(payload.storeId, 100);

  if (!/^[A-Za-z0-9_-]{8,100}$/.test(clientRequestId)) {
    throw Object.assign(new Error("Некорректный идентификатор заказа."), { statusCode: 400 });
  }
  if (!customerName || !/^\+996\d{9}$/.test(customerPhone) || !deliveryMethod) {
    throw Object.assign(new Error("Укажите имя, телефон и способ получения."), { statusCode: 400 });
  }
  if (!rawItems.length || rawItems.length > 100 || items.length !== rawItems.length) {
    throw Object.assign(new Error("Проверьте состав заказа."), { statusCode: 400 });
  }
  if (deliveryMethod === "delivery" && !deliveryAddress) {
    throw Object.assign(new Error("Укажите адрес доставки."), { statusCode: 400 });
  }
  if (deliveryMethod === "pickup" && !storeId) {
    throw Object.assign(new Error("Выберите магазин для самовывоза."), { statusCode: 400 });
  }

  return {
    clientRequestId,
    customerName,
    customerPhone,
    deliveryMethod,
    storeId,
    storeName: asNullableText(payload.storeName, 300),
    storeAddress: asNullableText(payload.storeAddress, 500),
    deliveryAddress,
    comment: asNullableText(payload.comment, 2_000),
    orderKind: payload.orderKind === "reservation" ? "reservation" : "order",
    projectNote: asNullableText(payload.projectNote, 500),
    items
  };
};

const safeHeaderEquals = (header: string | string[] | undefined, expected: string) => {
  const actual = Array.isArray(header) ? header[0] || "" : header || "";
  if (!actual || actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};

const isCatalogPath = (path: string) => {
  const lower = decodeURIComponent(path).toLowerCase();
  return !blockedPathParts.some((part) => lower.includes(part)) &&
    catalogPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

const toPublicOrder = (order: NonNullable<Awaited<ReturnType<typeof getAppOrder>>>) => {
  const { telegram: _telegram, ...publicOrder } = order;
  return {
    ...publicOrder,
    order_status_events: publicOrder.order_status_events.map(({ source: _source, ...event }) => event)
  };
};

const deliverTelegramOrder = async (orderId: string) => {
  if (!databasePool || !telegramConfigured) {
    return false;
  }
  const order = await getAppOrder(databasePool, orderId);
  if (!order || order.telegram.message_id !== null) {
    return true;
  }

  try {
    const message = await sendOrderToTelegram(telegramConfig, order);
    await markTelegramSent(databasePool, orderId, telegramConfig.chatId, message.message_id);
    return true;
  } catch (error) {
    await markTelegramFailed(databasePool, orderId);
    console.error("[telegram:delivery]", error instanceof Error ? error.message : error);
    return false;
  }
};

const deliverPendingTelegramOrders = async () => {
  if (!databasePool || !telegramConfigured) {
    return;
  }
  const orderIds = await claimTelegramDeliveries(databasePool);
  for (const orderId of orderIds) {
    await deliverTelegramOrder(orderId);
  }
};

const handleTelegramWebhook = async (
  req: IncomingMessage,
  res: ServerResponse,
  payload: Record<string, unknown>
) => {
  if (!telegramConfigured || !safeHeaderEquals(req.headers["x-telegram-bot-api-secret-token"], webhookSecret)) {
    sendJson(req, res, 401, { ok: false });
    return;
  }

  const incomingMessage = payload.message;
  if (incomingMessage && typeof incomingMessage === "object" && !Array.isArray(incomingMessage)) {
    const messageRecord = incomingMessage as Record<string, unknown>;
    const text = asText(messageRecord.text, 500);
    const from = asRecord(messageRecord.from);
    const chat = asRecord(messageRecord.chat);
    const telegramUserId = Number(from.id);
    const telegramChatId = Number(chat.id);
    const linkMatch = text.match(/^\/start\s+link_([A-Za-z0-9_-]{20,100})$/);
    if (linkMatch && databasePool && Number.isSafeInteger(telegramUserId) && Number.isSafeInteger(telegramChatId)) {
      try {
        await consumeTelegramLinkToken(
          databasePool,
          linkMatch[1],
          telegramUserId,
          telegramChatId,
          typeof from.username === "string" ? from.username : null
        );
        await sendTelegramText(telegramConfig, String(telegramChatId), "✅ Telegram подключён к аккаунту Авантехник. Настройки уведомлений доступны в приложении.");
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Не удалось подключить Telegram.";
        await sendTelegramText(telegramConfig, String(telegramChatId), `Не удалось подключить аккаунт: ${messageText}`).catch(() => undefined);
      }
    }
    sendJson(req, res, 200, { ok: true });
    return;
  }

  const callback = payload.callback_query;
  if (!callback || typeof callback !== "object" || Array.isArray(callback)) {
    sendJson(req, res, 200, { ok: true });
    return;
  }

  const callbackRecord = callback as Record<string, unknown>;
  const callbackId = asText(callbackRecord.id, 200);
  const parsed = parseOrderStatusCallback(callbackRecord.data);
  const message = callbackRecord.message && typeof callbackRecord.message === "object" && !Array.isArray(callbackRecord.message)
    ? callbackRecord.message as Record<string, unknown>
    : null;
  const chat = message?.chat && typeof message.chat === "object" && !Array.isArray(message.chat)
    ? message.chat as Record<string, unknown>
    : null;
  const chatId = chat?.id === undefined ? "" : String(chat.id);
  const from = callbackRecord.from && typeof callbackRecord.from === "object" && !Array.isArray(callbackRecord.from)
    ? callbackRecord.from as Record<string, unknown>
    : null;
  const adminUserId = Number(from?.id);

  const isAdmin = callbackId && chatId === telegramConfig.chatId && Number.isSafeInteger(adminUserId)
    ? await isTelegramChatAdmin(telegramConfig, adminUserId).catch(() => false)
    : false;

  if (!callbackId || chatId !== telegramConfig.chatId || !isAdmin) {
    if (callbackId) {
      await answerTelegramCallback(telegramConfig, callbackId, "Эта кнопка доступна только администраторам.", true).catch(() => undefined);
    }
    sendJson(req, res, 200, { ok: true });
    return;
  }

  if (!parsed) {
    await answerTelegramCallback(telegramConfig, callbackId, "Кнопка устарела.", true).catch(() => undefined);
    sendJson(req, res, 200, { ok: true });
    return;
  }

  try {
    const pool = requireDatabase();
    const result = await updateAppOrderStatus(pool, parsed.orderId, parsed.status);
    const order = await getAppOrder(pool, parsed.orderId);
    if (!order) {
      throw Object.assign(new Error("Заказ не найден."), { statusCode: 404 });
    }
    const messageId = Number(message?.message_id || order.telegram.message_id);
    if (messageId) {
      await editTelegramOrder(telegramConfig, order, messageId);
    }
    if (result.changed && order.order_kind === "reservation") {
      const owner = await pool.query<{ customer_id: string }>("SELECT customer_id FROM app_orders WHERE id = $1", [order.id]);
      if (owner.rows[0]) {
        await enqueueNotification(pool, {
          recipientAccountId: owner.rows[0].customer_id,
          eventType: `reservation.${order.status}`,
          dedupeKey: `reservation:${order.id}:${order.status}`,
          text: `Статус резерва ${order.order_number}: ${ORDER_STATUS_LABELS[order.status]}.`
        }).catch(() => undefined);
      }
    }
    await answerTelegramCallback(
      telegramConfig,
      callbackId,
      result.changed ? `Статус: ${ORDER_STATUS_LABELS[order.status]}` : "Статус уже был обновлён."
    );
    sendJson(req, res, 200, { ok: true });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 500;
    const messageText = error instanceof Error ? error.message : "Не удалось обновить статус.";
    await answerTelegramCallback(telegramConfig, callbackId, messageText, true).catch(() => undefined);
    sendJson(req, res, status >= 500 ? 500 : 200, { ok: status < 500 });
  }
};

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const path = requestUrl.pathname;
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    res.writeHead(204, getCorsHeaders(req));
    res.end();
    return;
  }

  if (path === "/health" && req.method === "GET") {
    let reachable=false;
    if(databasePool) try { await databasePool.query('SELECT 1'); reachable=true; } catch { /* Health must report the failed dependency. */ }
    const ready = Boolean(reachable && configuredAuthSecret && telegramConfigured && webhookUrl);
    sendJson(req, res, ready ? 200 : 503, {
      ok: ready,
      database: reachable ? "reachable" : databasePool ? "unreachable" : "missing",
      authTokenSecret: configuredAuthSecret ? "present" : "missing",
      telegramBotToken: telegramConfig.botToken ? "present" : "missing",
      telegramChatId: telegramConfig.chatId ? "present" : "missing",
      telegramWebhook: webhookUrl ? "configured" : "missing",
      plumberProgram: "configured",
      adminAccess: "database-role-only",
      catalog: catalogBaseUrl && catalogToken ? "read-only" : "missing"
    });
    return;
  }

  try {
    if (path === "/telegram/webhook" && req.method === "POST") {
      await handleTelegramWebhook(req, res, await readJsonBody(req));
      return;
    }

    const pool = requireDatabase();
    if (path === '/media' && req.method === 'POST') {
      const accountId=await requireCustomerId(req);
      await enforceRateLimit(req,'media-upload',20,60*60_000);
      const body=await readJsonBody(req,2_900_000);
      sendJson(req,res,201,{data:await uploadMedia(pool,accountId,asText(body.dataBase64,2_800_001),mediaProvider(env.MEDIA_PROVIDER_URL || '',env.MEDIA_PROVIDER_TOKEN || '',env.MEDIA_PUBLIC_HOST || ''))}); return;
    }
    if(path==='/plumber/profile/photo' && req.method==='PATCH') {
      const id=await requireCustomerId(req);const body=await readJsonBody(req);const url=asNullableText(body.url,1000);
      await requireOwnedMedia(pool,id,url?[url]:[]);
      await pool.query('UPDATE app_plumber_profiles SET profile_photo_url=$2,updated_at=now() WHERE account_id=$1',[id,url]);
      sendJson(req,res,200,{data:await getPlumberProfileByAccount(pool,id)});return;
    }
    if (path === '/public/documents' && req.method === 'GET') {
      sendJson(req,res,200,{data:await listPublicDocuments(pool)}); return;
    }
    if (path === '/profile' && req.method === 'DELETE') {
      const accountId=await requireCustomerId(req);
      await enforceRateLimit(req,'account-delete',5,60*60_000);
      const policy=(await listPublicDocuments(pool)).find(doc=>doc.kind==='deletion');
      const body=await readJsonBody(req);
      sendJson(req,res,200,await deleteAccount(pool,accountId,asText(body.password,200),parsePhoneProof(body.phoneProof),authTokenSecret,
        {mode:env.ACCOUNT_DELETION_MODE || '',version:policy?.version || ''},mediaProvider(env.MEDIA_PROVIDER_URL || '',env.MEDIA_PROVIDER_TOKEN || '',env.MEDIA_PUBLIC_HOST || ''))); return;
    }

    if (path === '/auth/phone/challenge' && req.method === 'POST') {
      await enforceRateLimit(req, 'phone-challenge', 20, 60 * 60_000);
      const payload = await readJsonBody(req);
      const action = asText(payload.action, 30) as PhoneAction;
      if (!['register','login','phone_change','password_reset','delete'].includes(action)) {
        throw Object.assign(new Error('Недопустимое действие.'), { statusCode: 400 });
      }
      let phone = normalizePhone(asText(payload.phone, 40));
      let accountId: string | null = null;
      if (action === 'phone_change' || action === 'delete') {
        accountId = await requireCustomerId(req);
        if (action === 'delete') phone = (await getCustomerProfile(pool, accountId)).user.phone;
      } else if (action !== 'register') {
        const found = await pool.query<{id:string}>('SELECT id FROM app_customers WHERE phone=$1', [phone]);
        accountId = found.rows[0]?.id ?? null;
        if (!accountId) {
          sendJson(req, res, 200, { challengeId: crypto.randomUUID(), expiresInSeconds: 300 }); return;
        }
      }
      sendJson(req, res, 200, await createPhoneChallenge(pool, authTokenSecret,
        httpSmsSender(env.SMS_PROVIDER_URL || '', env.SMS_PROVIDER_TOKEN || ''), action, phone, accountId)); return;
    }
    if (path === '/auth/refresh' && req.method === 'POST') {
      await enforceRateLimit(req, 'refresh', 60);
      const body = await readJsonBody(req);
      sendJson(req, res, 200, await refreshSession(pool, asText(body.refreshToken, 200), authTokenSecret)); return;
    }
    if (path === '/auth/logout' && req.method === 'POST') {
      const body = await readJsonBody(req);
      await revokeSession(pool, bearerToken(req.headers.authorization), authTokenSecret, asText(body.refreshToken,200));
      sendJson(req, res, 200, { success: true }); return;
    }
    if (path === '/auth/password/reset' && req.method === 'POST') {
      await enforceRateLimit(req, 'password-reset', 10, 10 * 60_000);
      const body = await readJsonBody(req);
      await resetPassword(pool, normalizePhone(asText(body.phone,40)), asText(body.password,200), parsePhoneProof(body.phoneProof), authTokenSecret);
      sendJson(req, res, 200, { success: true }); return;
    }

    if (path === "/auth/register" && req.method === "POST") {
      await enforceRateLimit(req, "auth-register", 8, 10 * 60_000);
      const payload = await readJsonBody(req);
      const result = await registerCustomer(
        pool,
        {
          phoneProof: parsePhoneProof(payload.phoneProof),
          name: typeof payload.name === "string" ? payload.name : undefined,
          phone: typeof payload.phone === "string" ? payload.phone : undefined,
          address: typeof payload.address === "string" ? payload.address : undefined,
          password: typeof payload.password === "string" ? payload.password : undefined,
          accountType: payload.accountType === "plumber" ? "plumber" : "customer",
          plumberApplication: payload.accountType === "plumber"
            ? parsePlumberApplication(asRecord(payload.plumberApplication))
            : undefined
        },
        authTokenSecret,
        adminPhoneNumbers
      );
      if (result.user.plumber) {
        await enqueueNotification(pool, {
          targetChatId: telegramConfig.chatId,
          eventType: "plumber.application_created",
          dedupeKey: `plumber:${result.user.plumber.id}:application:pending`,
          text: `🔧 Новая анкета сантехника\n${result.user.name}\nГород: ${result.user.plumber.city}\nПроверьте анкету в разделе администратора.`
        }).catch(() => undefined);
      }
      sendJson(req, res, 201, result);
      return;
    }

    if (path === "/auth/login" && req.method === "POST") {
      await enforceRateLimit(req, "auth-login", 15, 10 * 60_000);
      const payload = await readJsonBody(req);
      const result = await loginCustomer(
        pool,
        {
          phoneProof: parsePhoneProof(payload.phoneProof),
          phone: typeof payload.phone === "string" ? payload.phone : undefined,
          password: typeof payload.password === "string" ? payload.password : undefined
        },
        authTokenSecret,
        adminPhoneNumbers
      );
      sendJson(req, res, 200, result);
      return;
    }

    if (path === "/profile" && req.method === "GET") {
      sendJson(req, res, 200, await getCustomerProfile(pool, await requireCustomerId(req), adminPhoneNumbers));
      return;
    }

    if (path === "/profile" && ["PATCH", "PUT"].includes(req.method || "")) {
      const payload = await readJsonBody(req);
      const result = await updateCustomerProfile(pool, await requireCustomerId(req), {
        phoneProof: parsePhoneProof(payload.phoneProof),
        name: typeof payload.name === "string" ? payload.name : undefined,
        phone: typeof payload.phone === "string" ? payload.phone : undefined,
        address: typeof payload.address === "string" ? payload.address : undefined
      }, adminPhoneNumbers, authTokenSecret);
      sendJson(req, res, 200, result);
      return;
    }

    if (path === "/plumber/application" && req.method === "GET") {
      const accountId = await requireCustomerId(req);
      sendJson(req, res, 200, { data: await getPlumberProfileByAccount(pool, accountId) });
      return;
    }

    if (path === "/plumber/application" && req.method === "POST") {
      await enforceRateLimit(req, "plumber-application", 5, 60 * 60_000);
      const accountId = await requireCustomerId(req);
      const profile = await applyForPlumber(pool, accountId, parsePlumberApplication(await readJsonBody(req)));
      await enqueueNotification(pool, {
        targetChatId: telegramConfig.chatId,
        eventType: "plumber.application_created",
        dedupeKey: `plumber:${profile?.id}:application:pending:${profile?.updatedAt}`,
        text: `🔧 Новая анкета сантехника\n${profile?.fullName ?? "Имя не указано"}\nГород: ${profile?.city ?? "не указан"}\nПроверьте анкету в разделе администратора.`
      }).catch(() => undefined);
      sendJson(req, res, 201, { data: profile });
      return;
    }

    if (path === "/plumber/dashboard" && req.method === "GET") {
      sendJson(req, res, 200, { data: await getPlumberDashboard(pool, await requireCustomerId(req)) });
      return;
    }

    if (path === "/plumber/qr" && req.method === "GET") {
      const plumber = await requireApprovedPlumber(pool, await requireCustomerId(req));
      const dashboard = await getPlumberDashboard(pool, plumber.accountId);
      sendJson(req, res, 200, {
        data: {
          plumberName: plumber.fullName,
          loyaltyCode: plumber.loyaltyCode,
          qrPayload: plumberQrPayload(plumber.publicId),
          level: dashboard.level.current
        }
      });
      return;
    }

    if (path === "/plumber/loyalty/transactions" && req.method === "GET") {
      const limit = Math.floor(asNumber(requestUrl.searchParams.get("limit"), 30));
      const offset = Math.floor(asNumber(requestUrl.searchParams.get("offset"), 0));
      sendJson(req, res, 200, {
        data: await listLoyaltyTransactions(pool, await requireCustomerId(req), {
          status: asNullableText(requestUrl.searchParams.get("status"), 30) ?? undefined,
          type: asNullableText(requestUrl.searchParams.get("type"), 50) ?? undefined,
          limit,
          offset,
          cursor: asNullableText(requestUrl.searchParams.get("cursor"), 1000) ?? undefined
        })
      });
      return;
    }

    if (path === "/plumber/rewards" && req.method === "GET") {
      sendJson(req, res, 200, { data: await listRewards(pool, await requireCustomerId(req)) });
      return;
    }

    const rewardRedeemMatch = path.match(/^\/plumber\/rewards\/([^/]+)\/redeem$/);
    if (rewardRedeemMatch && req.method === "POST") {
      await enforceRateLimit(req, "reward-redemption", 10, 60 * 60_000);
      const payload = await readJsonBody(req);
      const result = await redeemReward(
        pool,
        await requireCustomerId(req),
        decodeURIComponent(rewardRedeemMatch[1]),
        asText(payload.clientRequestId, 100)
      );
      sendJson(req, res, result.created ? 201 : 200, { data: result });
      return;
    }

    if (path === "/plumber/content" && req.method === "GET") {
      sendJson(req, res, 200, { data: await listProgramContent(pool, await requireCustomerId(req)) });
      return;
    }

    const contentRegisterMatch = path.match(/^\/plumber\/content\/([^/]+)\/register$/);
    if (contentRegisterMatch && req.method === "POST") {
      const result = await registerForTraining(pool, await requireCustomerId(req), decodeURIComponent(contentRegisterMatch[1]));
      sendJson(req, res, result.created ? 201 : 200, { data: result });
      return;
    }

    if (path === "/plumber/reviews" && req.method === "GET") {
      sendJson(req, res, 200, { data: await listPlumberReviews(pool, await requireCustomerId(req)) });
      return;
    }

    if (path === "/telegram/link" && req.method === "GET") {
      sendJson(req, res, 200, { data: await getTelegramLinkStatus(pool, await requireCustomerId(req)) });
      return;
    }

    if (path === "/telegram/link-token" && req.method === "POST") {
      await enforceRateLimit(req, "telegram-link", 5, 10 * 60_000);
      sendJson(req, res, 201, { data: await createTelegramLinkToken(pool, await requireCustomerId(req), telegramBotUsername) });
      return;
    }

    if (path === "/telegram/preferences" && req.method === "PATCH") {
      const payload = await readJsonBody(req);
      const result = await updateTelegramPreferences(
        pool,
        await requireCustomerId(req),
        payload.notificationsEnabled !== false,
        Object.fromEntries(Object.entries(asRecord(payload.preferences)).map(([key, value]) => [key, value === true]))
      );
      sendJson(req, res, 200, { data: result });
      return;
    }

    if (path === "/service-requests" && req.method === "GET") {
      const limit = Math.floor(asNumber(requestUrl.searchParams.get("limit"), 30));
      const offset = Math.floor(asNumber(requestUrl.searchParams.get("offset"), 0));
      sendJson(req, res, 200, { data: await listCustomerServiceRequests(pool, await requireCustomerId(req), limit, offset) });
      return;
    }

    if (path === "/service-requests" && req.method === "POST") {
      await enforceRateLimit(req, "service-request", 10, 60 * 60_000);
      const payload = await readJsonBody(req);
      const input: ServiceRequestInput = {
        serviceType: asText(payload.serviceType, 120),
        description: asText(payload.description, 2_000),
        district: asText(payload.district, 120),
        address: asNullableText(payload.address, 500),
        preferredAt: asNullableText(payload.preferredAt, 100),
        phone: asText(payload.phone, 40),
        photoUrls: asStringArray(payload.photoUrls, 5),
        relatedProductIds: asStringArray(payload.relatedProductIds, 50),
        relatedOrderId: asNullableText(payload.relatedOrderId, 100),
        consentToShare: asBoolean(payload.consentToShare)
      };
      sendJson(req, res, 201, { data: await createServiceRequest(pool, await requireCustomerId(req), input, telegramConfig.chatId) });
      return;
    }

    const serviceRequestCancelMatch = path.match(/^\/service-requests\/([^/]+)\/cancel$/);
    if (serviceRequestCancelMatch && req.method === "POST") {
      sendJson(req, res, 200, {
        data: await cancelCustomerServiceRequest(pool, await requireCustomerId(req), decodeURIComponent(serviceRequestCancelMatch[1]))
      });
      return;
    }

    const serviceRequestReviewMatch = path.match(/^\/service-requests\/([^/]+)\/review$/);
    if (serviceRequestReviewMatch && req.method === "POST") {
      const payload = await readJsonBody(req);
      sendJson(req, res, 201, {
        data: await createLeadReview(pool, await requireCustomerId(req), decodeURIComponent(serviceRequestReviewMatch[1]), {
          rating: asNumber(payload.rating),
          review: asNullableText(payload.review, 2_000),
          tags: asStringArray(payload.tags, 10)
        })
      });
      return;
    }

    if (path === "/plumber/leads" && req.method === "GET") {
      const limit = Math.floor(asNumber(requestUrl.searchParams.get("limit"), 30));
      const offset = Math.floor(asNumber(requestUrl.searchParams.get("offset"), 0));
      sendJson(req, res, 200, { data: await listPlumberLeads(pool, await requireCustomerId(req), limit, offset) });
      return;
    }

    const plumberLeadViewMatch = path.match(/^\/plumber\/leads\/([^/]+)\/view$/);
    if (plumberLeadViewMatch && req.method === "POST") {
      sendJson(req, res, 200, {
        data: await markLeadViewed(pool, await requireCustomerId(req), decodeURIComponent(plumberLeadViewMatch[1]))
      });
      return;
    }

    const plumberLeadStatusMatch = path.match(/^\/plumber\/leads\/([^/]+)\/status$/);
    if (plumberLeadStatusMatch && req.method === "PATCH") {
      const payload = await readJsonBody(req);
      const nextStatus = ["accepted", "declined", "in_progress", "completed"].includes(String(payload.status))
        ? payload.status as "accepted" | "declined" | "in_progress" | "completed"
        : null;
      if (!nextStatus) throw Object.assign(new Error("Недоступный статус заявки."), { statusCode: 400 });
      sendJson(req, res, 200, {
        data: await updateLeadByPlumber(pool, await requireCustomerId(req), decodeURIComponent(plumberLeadStatusMatch[1]), nextStatus)
      });
      return;
    }

    if (path === "/admin/program" && req.method === "GET") {
      await requireAdminId(req);
      sendJson(req, res, 200, { data: await getAdminProgramOverview(pool) });
      return;
    }

    if (path === "/admin/plumbers" && req.method === "GET") {
      await requireAdminId(req);
      const requestedStatus = requestUrl.searchParams.get("status");
      const status = requestedStatus && ["pending", "approved", "rejected", "suspended"].includes(requestedStatus)
        ? requestedStatus as PlumberApplicationStatus
        : undefined;
      sendJson(req, res, 200, {
        data: await listPlumberApplications(
          pool,
          status,
          Math.floor(asNumber(requestUrl.searchParams.get("limit"), 50)),
          Math.floor(asNumber(requestUrl.searchParams.get("offset"), 0))
        )
      });
      return;
    }

    const adminPlumberStatusMatch = path.match(/^\/admin\/plumbers\/([^/]+)\/status$/);
    if (adminPlumberStatusMatch && req.method === "PATCH") {
      const actorId = await requireAdminId(req);
      const payload = await readJsonBody(req);
      const nextStatus = ["pending", "approved", "rejected", "suspended"].includes(String(payload.status))
        ? payload.status as PlumberApplicationStatus
        : null;
      if (!nextStatus) throw Object.assign(new Error("Недоступный статус анкеты."), { statusCode: 400 });
      const result = await updatePlumberApplicationStatus(
        pool,
        actorId,
        decodeURIComponent(adminPlumberStatusMatch[1]),
        nextStatus,
        asNullableText(payload.reason, 1_000)
      );
      if (result.profile) {
        await enqueueNotification(pool, {
          recipientAccountId: result.profile.accountId,
          eventType: `plumber.application_${nextStatus}`,
          dedupeKey: `plumber:${result.profile.id}:status:${nextStatus}:${result.profile.updatedAt}`,
          text: nextStatus === "approved"
            ? "Ваша анкета сантехника подтверждена. Профессиональный кабинет и программа лояльности доступны в приложении."
            : nextStatus === "rejected"
              ? `Анкета сантехника отклонена.${result.profile.rejectionReason ? ` Причина: ${result.profile.rejectionReason}` : ""}`
              : nextStatus === "suspended"
                ? "Доступ сантехника временно приостановлен. Обратитесь в поддержку Авантехник."
                : "Статус анкеты сантехника изменён на «на проверке»."
        }).catch(() => undefined);
      }
      sendJson(req, res, 200, { data: result });
      return;
    }

    if (path === "/admin/loyalty/config" && req.method === "GET") {
      await requireAdminId(req);
      sendJson(req, res, 200, { data: await getLoyaltyConfig(pool) });
      return;
    }

    if (path === "/admin/loyalty/config" && req.method === "PATCH") {
      const actorId = await requireAdminId(req);
      const payload = await readJsonBody(req);
      const levels = Array.isArray(payload.levels) ? payload.levels.map((value) => {
        const level = asRecord(value);
        return {
          id: asText(level.id, 100),
          thresholdMinor: typeof level.thresholdMinor === "string" || typeof level.thresholdMinor === "number" ? level.thresholdMinor : "",
          bonusRateBps: Math.floor(asNumber(level.bonusRateBps))
        };
      }) : undefined;
      sendJson(req, res, 200, {
        data: await updateLoyaltyConfiguration(pool, actorId, {
          baseRateBps: Math.floor(asNumber(payload.baseRateBps)),
          pendingDays: Math.floor(asNumber(payload.pendingDays)),
          rollingPeriodDays: Math.floor(asNumber(payload.rollingPeriodDays)),
          levels
        })
      });
      return;
    }

    if (path === "/admin/loyalty/release" && req.method === "POST") {
      await requireAdminId(req);
      sendJson(req, res, 200, { data: { released: await releasePendingBonuses(pool) } });
      return;
    }

    if (path === "/admin/receipts" && req.method === "POST") {
      await enforceRateLimit(req, "admin-receipt", 120, 60_000);
      const actorId = await requireAdminId(req);
      const result = await ingestReceipt(pool, parseReceiptInput(await readJsonBody(req)), actorId);
      sendJson(req, res, result.created ? 201 : 200, { data: result });
      return;
    }

    if (path === "/admin/returns" && req.method === "POST") {
      await enforceRateLimit(req, "admin-return", 120, 60_000);
      const actorId = await requireAdminId(req);
      const result = await ingestReturn(pool, parseReturnInput(await readJsonBody(req)), actorId);
      sendJson(req, res, result.created ? 201 : 200, { data: result });
      return;
    }

    if (path === "/admin/loyalty/adjustments" && req.method === "POST") {
      const actorId = await requireAdminId(req);
      const payload = await readJsonBody(req);
      sendJson(req, res, 201, {
        data: await createManualAdjustment(
          pool,
          actorId,
          asText(payload.plumberId, 100),
          typeof payload.amountMinor === "string" || typeof payload.amountMinor === "number" ? payload.amountMinor : "",
          asText(payload.reason, 1_000)
        )
      });
      return;
    }

    if (path === "/admin/leads" && req.method === "GET") {
      await requireAdminId(req);
      sendJson(req, res, 200, {
        data: await listAdminServiceRequests(
          pool,
          Math.floor(asNumber(requestUrl.searchParams.get("limit"), 50)),
          Math.floor(asNumber(requestUrl.searchParams.get("offset"), 0))
        )
      });
      return;
    }

    const adminLeadCandidatesMatch = path.match(/^\/admin\/leads\/([^/]+)\/candidates$/);
    if (adminLeadCandidatesMatch && req.method === "GET") {
      await requireAdminId(req);
      sendJson(req, res, 200, { data: await listLeadCandidates(pool, decodeURIComponent(adminLeadCandidatesMatch[1])) });
      return;
    }

    const adminLeadAssignMatch = path.match(/^\/admin\/leads\/([^/]+)\/assign$/);
    if (adminLeadAssignMatch && req.method === "POST") {
      const actorId = await requireAdminId(req);
      const payload = await readJsonBody(req);
      sendJson(req, res, 200, {
        data: await assignServiceRequest(
          pool,
          actorId,
          decodeURIComponent(adminLeadAssignMatch[1]),
          asText(payload.plumberId, 100)
        )
      });
      return;
    }

    const adminReviewMatch = path.match(/^\/admin\/reviews\/([^/]+)$/);
    if (adminReviewMatch && req.method === "PATCH") {
      const actorId = await requireAdminId(req);
      const payload = await readJsonBody(req);
      const moderationStatus = ["published", "hidden", "reported"].includes(String(payload.status))
        ? payload.status as "published" | "hidden" | "reported"
        : null;
      if (!moderationStatus) throw Object.assign(new Error("Недоступный статус отзыва."), { statusCode: 400 });
      sendJson(req, res, 200, {
        data: await moderateReview(pool, actorId, decodeURIComponent(adminReviewMatch[1]), moderationStatus, asText(payload.reason, 1_000))
      });
      return;
    }

    if (path === "/admin/rewards" && ["POST", "PUT"].includes(req.method || "")) {
      const actorId = await requireAdminId(req);
      sendJson(req, res, 200, { data: await upsertReward(pool, actorId, await readJsonBody(req)) });
      return;
    }

    const adminRedemptionMatch = path.match(/^\/admin\/redemptions\/([^/]+)\/status$/);
    if (adminRedemptionMatch && req.method === "PATCH") {
      const actorId = await requireAdminId(req);
      const payload = await readJsonBody(req);
      const status = ["approved", "fulfilled", "cancelled"].includes(String(payload.status))
        ? payload.status as "approved" | "fulfilled" | "cancelled"
        : null;
      if (!status) throw Object.assign(new Error("Недоступный статус выдачи."), { statusCode: 400 });
      sendJson(req, res, 200, {
        data: await processRewardRedemption(pool, actorId, decodeURIComponent(adminRedemptionMatch[1]), status, asNullableText(payload.note, 1_000))
      });
      return;
    }

    if (path === "/admin/promotions" && ["POST", "PUT"].includes(req.method || "")) {
      const actorId = await requireAdminId(req);
      sendJson(req, res, 200, { data: await upsertLoyaltyPromotion(pool, actorId, await readJsonBody(req)) });
      return;
    }

    if (path === "/admin/exclusions" && ["POST", "PUT"].includes(req.method || "")) {
      const actorId = await requireAdminId(req);
      sendJson(req, res, 200, { data: await setLoyaltyExclusion(pool, actorId, await readJsonBody(req)) });
      return;
    }

    if (path === "/admin/content" && ["POST", "PUT"].includes(req.method || "")) {
      const actorId = await requireAdminId(req);
      sendJson(req, res, 200, { data: await upsertProgramContent(pool, actorId, await readJsonBody(req)) });
      return;
    }

    if (path === '/orders/quote' && req.method === 'POST') {
      await requireCustomerId(req);
      const payload = parseNewOrder(await readJsonBody(req));
      const quote = await trustedOrder(pool, payload, {organizationId: env.APP_ORGANIZATION_ID || '', deliveryBranchId: env.DELIVERY_BRANCH_ID}, false);
      sendJson(req,res,200,{data:{...quote,totalAmount:trustedTotal(quote.items)}}); return;
    }
    if (path === "/orders" && req.method === "GET") {
      sendJson(req, res, 200, { data: await listAppOrders(pool, await requireCustomerId(req)) });
      return;
    }

    if (path === "/orders" && req.method === "POST") {
      if (!telegramConfigured) {
        throw Object.assign(new Error("Сервис заказов временно недоступен."), { statusCode: 503 });
      }
      const customerId = await requireCustomerId(req);
      const orderPayload = parseNewOrder(await readJsonBody(req));
      if (orderPayload.orderKind === "reservation") {
        await requireApprovedPlumber(pool, customerId);
        if (orderPayload.deliveryMethod !== "pickup") {
          throw Object.assign(new Error("Резерв доступен только для самовывоза."), { statusCode: 400 });
        }
      }
      const result = await createAppOrder(pool, customerId, orderPayload, {organizationId:env.APP_ORGANIZATION_ID || "",deliveryBranchId:env.DELIVERY_BRANCH_ID});
      if (!result.order) {
        throw new Error("Не удалось сохранить заказ.");
      }
      const delivered = result.order.telegram.message_id !== null;
      const order = await getAppOrder(pool, result.order.id, customerId);
      sendJson(req, res, result.created ? 201 : 200, {
        data: order ? toPublicOrder(order) : null,
        telegram_notification: delivered ? "sent" : "pending"
      });
      return;
    }

    const orderMatch = path.match(/^\/orders\/([^/]+)$/);
    if (orderMatch && req.method === "GET") {
      const order = await getAppOrder(pool, decodeURIComponent(orderMatch[1]), await requireCustomerId(req));
      if (!order) {
        throw Object.assign(new Error("Заказ не найден."), { statusCode: 404 });
      }
      sendJson(req, res, 200, { data: toPublicOrder(order) });
      return;
    }

    if (path === "/image-search") {
      sendJson(req, res, 501, { error: "Image search endpoint is not connected yet." });
      return;
    }

    if (isCatalogPath(path)) {
      if (!["GET", "HEAD"].includes(req.method || "")) {
        sendJson(req, res, 405, { error: "The catalog integration is read-only." });
        return;
      }
      if (!catalogBaseUrl || !catalogToken) {
        sendJson(req, res, 503, { error: "Catalog service is not configured." });
        return;
      }
      const response = await fetch(`${catalogBaseUrl}${path}${requestUrl.search}`, {
        method: req.method,
        headers: { Accept: "application/json", Authorization: `Bearer ${catalogToken}` }
      });
      const responseBody = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, {
        ...getCorsHeaders(req),
        "Cache-Control": "public, max-age=60",
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "Content-Length": responseBody.byteLength,
        "X-Content-Type-Options": "nosniff"
      });
      res.end(responseBody);
      return;
    }

    sendJson(req, res, 404, { error: "Маршрут не найден." });
  } catch (error) {
    if (shouldLog) {
      console.error("[app-server:error]", error);
    }
    if (!res.headersSent) {
      sendError(req, res, error);
    }
  } finally {
    if (shouldLog) {
      console.log(`${req.method} ${path} -> ${res.statusCode} ${Date.now() - startedAt}ms`);
    }
  }
});

const startServer = async () => {
  if (!databasePool) {
    throw new Error("DATABASE_URL is required.");
  }
  if (env.NODE_ENV === "production" && !configuredAuthSecret) {
    throw new Error("A non-placeholder AUTH_TOKEN_SECRET is required in production.");
  }
  if (env.NODE_ENV === "production" && (!telegramConfigured || !webhookUrl)) {
    throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and a public Telegram webhook URL are required in production.");
  }

  if(env.NODE_ENV==='production') {
    const required=await databasePool.query("SELECT to_regclass('app_sessions') sessions,to_regclass('app_order_offers') offers,to_regclass('app_public_documents') documents,to_regclass('app_uploaded_media') media");
    if(Object.values(required.rows[0]).some(value=>!value)) throw new Error('Apply the reviewed 20260918 migration before starting this backend.');
  } else await ensureSchema(databasePool);
  if (telegramConfigured && webhookUrl) {
    try {
      await registerTelegramWebhook(telegramConfig, webhookUrl, webhookSecret);
      console.log("Telegram webhook registered.");
    } catch (error) {
      console.error("[telegram:webhook]", error instanceof Error ? error.message : error);
    }
  } else if (shouldLog) {
    console.log("Telegram webhook not registered: no public webhook URL in local development.");
  }

  await deliverPendingTelegramOrders();
  await releasePendingBonuses(databasePool).catch((error) => {
    console.error("[loyalty:release]", error instanceof Error ? error.message : error);
  });
  await deliverNotificationOutbox(
    databasePool,
    (chatId, text) => sendTelegramText(telegramConfig, chatId, text)
  ).catch((error) => {
    console.error("[telegram:notifications]", error instanceof Error ? error.message : error);
  });
  const retryTimer = setInterval(() => {
    void deliverPendingTelegramOrders().catch((error) => {
      console.error("[telegram:retry]", error instanceof Error ? error.message : error);
    });
    void deliverNotificationOutbox(
      databasePool,
      (chatId, text) => sendTelegramText(telegramConfig, chatId, text)
    ).catch((error) => {
      console.error("[telegram:notifications]", error instanceof Error ? error.message : error);
    });
  }, 30_000);
  const loyaltyTimer = setInterval(() => {
    void releasePendingBonuses(databasePool).catch((error) => {
      console.error("[loyalty:release]", error instanceof Error ? error.message : error);
    });
  }, 5 * 60_000);
  void retryTimer;
  void loyaltyTimer;

  server.listen(port, host, () => {
    console.log(`Avantehnik app server listening on http://${host}:${port}`);
    console.log(`DATABASE_URL: ${databasePool ? "present" : "missing"}`);
    console.log(`TELEGRAM: ${telegramConfigured ? "configured" : "missing"}`);
    console.log(`CATALOG: ${catalogBaseUrl && catalogToken ? "read-only" : "missing"}`);
  });
};

void startServer().catch((error) => {
  console.error("[server:start]", error instanceof Error ? error.message : error);
  process.exit(1);
});
