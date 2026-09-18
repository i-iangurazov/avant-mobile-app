import { createHash } from "node:crypto";
import type { AppOrderDetail, AppOrderStatus } from "./orders";
import { allowedNextStatuses, ORDER_STATUS_LABELS } from "./orders";

export type TelegramConfig = {
  botToken: string;
  chatId: string;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramMessage = {
  message_id: number;
};

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeHtmlLimited = (value: string, maxLength: number) => {
  let escaped = "";
  for (const character of value) {
    const encoded = escapeHtml(character);
    if (escaped.length + encoded.length > maxLength) {
      break;
    }
    escaped += encoded;
  }
  return escaped;
};

const displayPrice = (value: string | number | null, fallback: string | null) => {
  if (value === null || value === "") {
    return fallback || "цена уточняется";
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("ru-RU")} сом` : fallback || "цена уточняется";
};

export const telegramWebhookSecret = (botToken: string, authTokenSecret: string) =>
  createHash("sha256").update(`${botToken}:${authTokenSecret}`).digest("hex");

export const resolveTelegramWebhookUrl = (explicitUrl: string, railwayDomain: string) => {
  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "");
  }
  return railwayDomain ? `https://${railwayDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/telegram/webhook` : "";
};

const telegramRequest = async <T>(config: TelegramConfig, method: string, payload: unknown) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !data.ok || data.result === undefined) {
      throw new Error(data.description || `Telegram API returned ${response.status}`);
    }
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
};

const statusButtons = (order: AppOrderDetail) => {
  const buttons = allowedNextStatuses(order).map((status) => ({
    text: status === "cancelled" ? `❌ ${ORDER_STATUS_LABELS[status]}` : ORDER_STATUS_LABELS[status],
    callback_data: `o:${order.id}:${status}`
  }));
  return buttons.map((button) => [button]);
};

export const formatTelegramOrder = (order: AppOrderDetail) => {
  const itemLines = order.order_items.map(
    (item, index) =>
      `${index + 1}. ${escapeHtmlLimited(item.product_name, 240)} — ${item.quantity} шт. × ${escapeHtmlLimited(
        displayPrice(item.unit_price, item.unit_price_label),
        120
      )}`
  );
  const fulfilment = order.delivery_method === "pickup"
    ? `Самовывоз: ${order.store ? `${order.store.name}, ${order.store.address}` : order.store_id || "магазин не указан"}`
    : `Доставка: ${order.delivery_address || "адрес не указан"}`;
  const header = [
    `${order.order_kind === "reservation" ? "📌" : "🛒"} <b>${order.order_kind === "reservation" ? "Резерв" : "Заказ"} ${escapeHtmlLimited(order.order_number, 150)}</b>`,
    `Статус: <b>${escapeHtmlLimited(ORDER_STATUS_LABELS[order.status as AppOrderStatus] || order.status, 100)}</b>`,
    "",
    `👤 ${escapeHtmlLimited(order.customer_name, 300)}`,
    `📞 ${escapeHtmlLimited(order.customer_phone, 80)}`,
    `📦 ${escapeHtmlLimited(fulfilment, 600)}`,
    order.comment ? `💬 ${escapeHtmlLimited(order.comment, 500)}` : null,
    ""
  ].filter((line) => line !== null) as string[];
  const footer = [
    "",
    `Итого: <b>${escapeHtmlLimited(displayPrice(order.total_amount, order.total_label), 120)}</b>`,
    `Создан: ${escapeHtmlLimited(new Date(order.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Bishkek" }), 100)}`
  ];
  const visibleItems: string[] = [];
  for (const line of itemLines) {
    const candidate = [...header, ...visibleItems, line, ...footer].join("\n");
    if (candidate.length > 3_900) {
      break;
    }
    visibleItems.push(line);
  }
  if (visibleItems.length < itemLines.length) {
    visibleItems.push(`… ещё ${itemLines.length - visibleItems.length} поз.`);
  }
  return [...header, ...visibleItems, ...footer].join("\n");
};

export async function sendOrderToTelegram(config: TelegramConfig, order: AppOrderDetail) {
  return telegramRequest<TelegramMessage>(config, "sendMessage", {
    chat_id: config.chatId,
    text: formatTelegramOrder(order),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: statusButtons(order) }
  });
}

export async function sendTelegramText(config: TelegramConfig, chatId: string, text: string) {
  return telegramRequest<TelegramMessage>(config, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 3_500),
    disable_web_page_preview: true
  });
}

export async function editTelegramOrder(config: TelegramConfig, order: AppOrderDetail, messageId: number) {
  return telegramRequest<TelegramMessage | true>(config, "editMessageText", {
    chat_id: config.chatId,
    message_id: messageId,
    text: formatTelegramOrder(order),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: statusButtons(order) }
  });
}

export async function answerTelegramCallback(
  config: TelegramConfig,
  callbackQueryId: string,
  text: string,
  showAlert = false
) {
  return telegramRequest<true>(config, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
    cache_time: 0
  });
}

export async function isTelegramChatAdmin(config: TelegramConfig, userId: number) {
  if (!config.chatId.startsWith("-") && String(userId) === config.chatId) {
    return true;
  }
  const member = await telegramRequest<{ status: string }>(config, "getChatMember", {
    chat_id: config.chatId,
    user_id: userId
  });
  return member.status === "administrator" || member.status === "creator";
}

export async function registerTelegramWebhook(
  config: TelegramConfig,
  webhookUrl: string,
  secretToken: string
) {
  return telegramRequest<true>(config, "setWebhook", {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ["callback_query", "message"],
    drop_pending_updates: false
  });
}

export function parseOrderStatusCallback(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(/^o:([0-9a-f-]{36}):(confirmed|assembling|ready_for_pickup|on_the_way|completed|cancelled)$/i);
  if (!match) {
    return null;
  }
  return { orderId: match[1], status: match[2] as AppOrderStatus };
}
