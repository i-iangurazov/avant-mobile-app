import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number(process.env.CDP_PORT || 9344);
const baseUrl = process.env.APP_URL || "http://localhost:8081";
const screenshotPath = process.argv[2] || "/tmp/avantehnik-auth-flow.png";
const profileDir = `/tmp/avantehnik-auth-flow-${Date.now()}`;
const phone = `+996700${Date.now().toString().slice(-6)}`;
const password = "test12345";

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--disable-default-apps",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-sync",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  "--window-size=390,844",
  `${baseUrl}/register`
], {
  stdio: ["ignore", "ignore", "ignore"]
});

const waitForJson = async (path) => {
  const url = `http://127.0.0.1:${port}${path}`;
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // keep polling
    }
    await delay(250);
  }
  throw new Error(`CDP endpoint did not respond: ${url}`);
};

const connect = (webSocketDebuggerUrl) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl);
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

const targets = await waitForJson("/json/list");
const page = targets.find((target) => target.type === "page") || targets[0];
const ws = await connect(page.webSocketDebuggerUrl);

let nextId = 1;
const pending = new Map();
const events = [];

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id).resolve(message);
    pending.delete(message.id);
    return;
  }

  if (message.method === "Network.responseReceived") {
    const response = message.params.response;
    if (response.url.includes(":8787") || response.url.includes("/auth/")) {
      events.push({ type: "response", status: response.status, url: response.url });
    }
  }

  if (message.method === "Runtime.consoleAPICalled") {
    events.push({
      type: "console",
      level: message.params.type,
      text: message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ")
    });
  }
});

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { resolve });
    ws.send(JSON.stringify({ id, method, params }));
  });

try {
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: `${baseUrl}/register` });
  await delay(4000);

  await send("Runtime.evaluate", {
    expression: `
      (() => {
        const values = ["Тест Покупатель", "${phone}", "Бишкек", "${password}", "${password}"];
        const inputs = Array.from(document.querySelectorAll("input"));
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        inputs.forEach((input, index) => {
          input.focus();
          valueSetter?.call(input, values[index] || "");
          input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: values[index] || "" }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.blur();
        });
        const buttons = Array.from(document.querySelectorAll("button"));
        const submit = buttons.find((button) => button.innerText.includes("Создать аккаунт"));
        submit?.click();
        return { inputCount: inputs.length, submitFound: Boolean(submit) };
      })()
    `,
    returnByValue: true
  });

  await delay(7000);
  const catalogText = await send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true
  });
  const reachedCatalog = String(catalogText.result.result.value).includes("Каталог");

  if (reachedCatalog) {
    await send("Page.navigate", { url: `${baseUrl}/profile` });
    await delay(5000);
  }

  const bodyText = await send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true
  });
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.result.data, "base64"));

  const reachedProfile = String(bodyText.result.result.value).includes("Тест Покупатель");
  console.log(JSON.stringify(
    {
      phone,
      reachedCatalog,
      reachedProfile,
      screenshotPath,
      bodyText: bodyText.result.result.value,
      events
    },
    null,
    2
  ));
  if (!reachedCatalog || !reachedProfile) {
    process.exitCode = 1;
  }
} finally {
  ws.close();
  chrome.kill("SIGTERM");
}
