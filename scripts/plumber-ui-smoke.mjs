import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

const { Pool } = pg;
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const cdpPort = Number(process.env.CDP_PORT || 9355);
const baseUrl = process.env.APP_URL || "http://localhost:8081";
const apiUrl = process.env.API_URL || "http://127.0.0.1:8787";
const databaseUrl = process.env.DATABASE_URL || "";
const databaseHost = databaseUrl ? new URL(databaseUrl).hostname : "";
if (!["127.0.0.1", "localhost", "::1"].includes(databaseHost)) throw new Error("Plumber UI smoke refuses a non-local database.");

const phone = `+996703${Date.now().toString().slice(-6)}`;
const password = "test12345";
const dashboardScreenshot = process.argv[2] || "/tmp/avantehnik-plumber-dashboard.png";
const qrScreenshot = process.argv[3] || "/tmp/avantehnik-plumber-qr.png";
const pool = new Pool({ connectionString: databaseUrl });
let accountId = "";

const registered = await fetch(`${apiUrl}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Тест Мастер",
    phone,
    password,
    accountType: "plumber",
    plumberApplication: {
      fullName: "Тест Мастер",
      city: "Бишкек",
      workingDistricts: ["Октябрьский"],
      specializations: ["Монтаж сантехники"],
      experienceYears: 8,
      programConsent: true,
      dataProcessingConsent: true
    }
  })
});
if (!registered.ok) throw new Error(`Could not create UI smoke plumber: ${registered.status} ${await registered.text()}`);
const registration = await registered.json();
accountId = registration.user.id;
await pool.query("UPDATE app_plumber_profiles SET application_status = 'approved', verified_at = now() WHERE account_id = $1", [accountId]);
await pool.query("INSERT INTO app_account_roles (account_id, role, is_active) VALUES ($1, 'plumber', true) ON CONFLICT (account_id, role) DO UPDATE SET is_active = true", [accountId]);

const profileDir = `/tmp/avantehnik-plumber-ui-${Date.now()}`;
const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--disable-default-apps",
  "--disable-background-networking", "--disable-component-update", "--disable-sync",
  `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profileDir}`, "--window-size=390,844", `${baseUrl}/login`
], { stdio: ["ignore", "ignore", "ignore"] });

const waitForJson = async (path) => {
  for (let index = 0; index < 80; index += 1) {
    try { const response = await fetch(`http://127.0.0.1:${cdpPort}${path}`); if (response.ok) return response.json(); } catch {}
    await delay(250);
  }
  throw new Error("Chrome CDP did not start.");
};

const targets = await waitForJson("/json/list");
const page = targets.find((target) => target.type === "page") || targets[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let id = 1;
const pending = new Map();
const events = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return; }
  if (message.method === "Runtime.exceptionThrown") events.push({ type: "exception", text: message.params.exceptionDetails?.text, description: message.params.exceptionDetails?.exception?.description });
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) events.push({ type: message.params.type, text: message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ") });
});
const send = (method, params = {}) => new Promise((resolve) => { const requestId = id++; pending.set(requestId, resolve); ws.send(JSON.stringify({ id: requestId, method, params })); });

try {
  await send("Runtime.enable"); await send("Page.enable"); await send("Page.navigate", { url: `${baseUrl}/login` }); await delay(3500);
  await send("Runtime.evaluate", { expression: `(() => { const values = [${JSON.stringify(phone)}, ${JSON.stringify(password)}]; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; const inputs = Array.from(document.querySelectorAll("input")); inputs.forEach((input, index) => { setter?.call(input, values[index] || ""); input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: values[index] || "" })); input.dispatchEvent(new Event("change", { bubbles: true })); }); Array.from(document.querySelectorAll("button")).find((button) => button.innerText.includes("Войти"))?.click(); })()` });
  await delay(7000);
  const dashboardTextResult = await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
  const dashboardText = String(dashboardTextResult.result.result.value);
  const dashboardImage = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(dashboardScreenshot, Buffer.from(dashboardImage.result.data, "base64"));
  await send("Page.navigate", { url: `${baseUrl}/plumber/qr` }); await delay(4000);
  const qrTextResult = await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
  const qrText = String(qrTextResult.result.result.value);
  const qrImage = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(qrScreenshot, Buffer.from(qrImage.result.data, "base64"));
  const result = {
    reachedDashboard: dashboardText.includes("РАБОЧИЙ КАБИНЕТ") && dashboardText.includes("Тест Мастер"),
    reachedQr: qrText.includes("КОД УЧАСТНИКА") && qrText.includes("Покажите QR кассиру"),
    dashboardScreenshot, qrScreenshot,
    events: events.filter((event) => !String(event.text).includes("pointerEvents is deprecated"))
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.reachedDashboard || !result.reachedQr || result.events.some((event) => event.type === "exception" || event.type === "error")) process.exitCode = 1;
} finally {
  ws.close(); chrome.kill("SIGTERM");
  if (accountId) {
    await pool.query("DELETE FROM app_notification_outbox WHERE recipient_account_id = $1", [accountId]);
    await pool.query("DELETE FROM app_customers WHERE id = $1", [accountId]);
  }
  await pool.end();
}
