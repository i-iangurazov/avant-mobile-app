import { loadEnv } from "./server/env";

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

const callTelegram = async <T>(token: string, method: string, payload: unknown) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json() as TelegramResponse<T>;
  if (!response.ok || !data.ok || data.result === undefined) {
    throw new Error(data.description || `Telegram returned HTTP ${response.status}.`);
  }
  return data.result;
};

async function main() {
  const env = loadEnv();
  const botToken = env.TELEGRAM_BOT_TOKEN || "";
  const chatId = env.TELEGRAM_CHAT_ID || "";
  console.log(`TELEGRAM_BOT_TOKEN: ${botToken ? "present" : "missing"}`);
  console.log(`TELEGRAM_CHAT_ID: ${chatId ? "present" : "missing"}`);
  if (!botToken || !chatId) {
    throw new Error("Telegram credentials are missing.");
  }

  const bot = await callTelegram<{ id: number; is_bot: boolean }>(botToken, "getMe", {});
  if (!bot.is_bot) {
    throw new Error("The configured Telegram token does not belong to a bot.");
  }
  const chat = await callTelegram<{ id: number; type: string }>(botToken, "getChat", { chat_id: chatId });
  if (String(chat.id) !== chatId) {
    throw new Error("Telegram returned a different admin chat ID.");
  }
  const membership = await callTelegram<{ status: string; can_send_messages?: boolean }>(botToken, "getChatMember", {
    chat_id: chatId,
    user_id: bot.id
  });
  if (["left", "kicked"].includes(membership.status) || membership.can_send_messages === false) {
    throw new Error("The Telegram bot cannot send messages to the configured admin chat.");
  }
  console.log(`Bot: reachable (${bot.id})`);
  console.log(`Admin chat: reachable (${chat.type}, bot ${membership.status})`);
  console.log("Telegram configuration check passed without sending a message.");
}

void main().catch((error) => {
  console.error("Telegram check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
