// Explicit local transport double. Never loaded by production/start scripts.
import fs from 'node:fs';
if (process.env.DATABASE_URL !== 'postgresql://audit@127.0.0.1:55448/remediation' || !process.env.TELEGRAM_TEST_DIR) {
  throw new Error('Telegram transport double requires the isolated test database and directory');
}
const root = process.env.TELEGRAM_TEST_DIR;
const messages = new Map();
let nextId = 1000;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname !== 'api.telegram.org' || !url.pathname.startsWith('/botfixture:token/')) {
    throw new Error('Telegram test blocked external network');
  }
  const method = url.pathname.split('/').at(-1);
  const payload = JSON.parse(String(init?.body || '{}'));
  const mode = fs.readFileSync(root + '/mode', 'utf8').trim();
  fs.appendFileSync(root + '/calls.jsonl', JSON.stringify({ method, payload }) + '\n');
  if ((method === 'setWebhook' && mode === 'webhook-failure') || (method === 'sendMessage' && mode === 'send-failure')) {
    return Response.json({ ok: false, description: 'Isolated transport unavailable' }, { status: 503 });
  }
  if (method === 'getChatMember') return Response.json({ ok: true, result: { status: payload.user_id === 101 ? 'administrator' : 'member' } });
  if (method === 'sendMessage') {
    const message_id = ++nextId;
    messages.set(message_id, JSON.stringify([payload.text, payload.reply_markup]));
    return Response.json({ ok: true, result: { message_id } });
  }
  if (method === 'editMessageText') {
    const value = JSON.stringify([payload.text, payload.reply_markup]);
    if (messages.get(payload.message_id) === value) return Response.json({ ok: false, description: 'Bad Request: message is not modified' }, { status: 400 });
    messages.set(payload.message_id, value);
  }
  return Response.json({ ok: true, result: true });
};
