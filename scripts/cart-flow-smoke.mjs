import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number(process.env.CDP_PORT || 9335);
const baseUrl = process.env.APP_URL || "http://localhost:8081";
const outputPrefix = process.argv[2] || "/tmp/avantehnik-cart-flow";
const profileDir = `/tmp/avantehnik-cdp-cart-profile-${Date.now()}`;
const windowSize = process.env.WINDOW_SIZE || "390,844";

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
  `--window-size=${windowSize}`,
  `${baseUrl}/cart`
], {
  stdio: ["ignore", "ignore", "ignore"]
});

const waitForJson = async (path) => {
  const url = `http://127.0.0.1:${port}${path}`;
  let lastError;
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError || new Error(`CDP endpoint did not respond: ${url}`);
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

  if (message.method === "Runtime.consoleAPICalled") {
    events.push({
      type: "console",
      level: message.params.type,
      text: message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ")
    });
  }

  if (message.method === "Runtime.exceptionThrown") {
    events.push({
      type: "exception",
      text: message.params.exceptionDetails?.text,
      description: message.params.exceptionDetails?.exception?.description
    });
  }

  if (message.method === "Network.responseReceived") {
    const response = message.params.response;
    if (response.url.includes(":8787") || response.url.includes("/products")) {
      events.push({
        type: "response",
        status: response.status,
        url: response.url
      });
    }
  }
});

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { resolve });
    ws.send(JSON.stringify({ id, method, params }));
  });

const text = async () => {
  const result = await send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true
  });
  return result.result.result.value || "";
};

const screenshot = async (path) => {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  writeFileSync(path, Buffer.from(result.result.data, "base64"));
};

try {
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");

  await send("Page.navigate", { url: `${baseUrl}/cart` });
  await delay(5000);
  const emptyCartText = await text();
  const emptyCartScreenshot = `${outputPrefix}-empty.png`;
  await screenshot(emptyCartScreenshot);

  await send("Page.navigate", { url: `${baseUrl}/category/mixers` });
  await delay(Number(process.env.VISUAL_WAIT_MS || 9000));
  const clickResult = await send("Runtime.evaluate", {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
      const addButton = buttons.find((button) => (button.textContent || '').includes('В корзину'));
      if (!addButton) {
        return {
          clicked: false,
          visibleButtons: buttons.slice(0, 20).map((button) => button.textContent || button.getAttribute('aria-label') || '')
        };
      }
      addButton.click();
      return { clicked: true, text: addButton.textContent || '' };
    })()`,
    returnByValue: true
  });
  await delay(1800);

  const toastText = await text();
  const toastScreenshot = `${outputPrefix}-toast.png`;
  await screenshot(toastScreenshot);

  await send("Page.navigate", { url: `${baseUrl}/cart` });
  await delay(5000);
  const filledCartText = await text();
  const filledCartScreenshot = `${outputPrefix}-filled.png`;
  await screenshot(filledCartScreenshot);

  const checkoutClickResult = await send("Runtime.evaluate", {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
      const checkoutButton = buttons.find((button) => (button.textContent || '').includes('Оформить заказ'));
      if (!checkoutButton) {
        return {
          clicked: false,
          visibleButtons: buttons.slice(0, 20).map((button) => button.textContent || button.getAttribute('aria-label') || '')
        };
      }
      checkoutButton.click();
      return { clicked: true, text: checkoutButton.textContent || '' };
    })()`,
    returnByValue: true
  });
  await delay(3500);
  const checkoutText = await text();
  const checkoutScreenshot = `${outputPrefix}-checkout.png`;
  await screenshot(checkoutScreenshot);

  const result = {
    emptyCartScreenshot,
    toastScreenshot,
    filledCartScreenshot,
    checkoutScreenshot,
    clickedAddToCart: clickResult.result.result.value,
    clickedCheckout: checkoutClickResult.result.result.value,
    emptyCartOk: emptyCartText.includes("Корзина пуста"),
    toastOk: toastText.includes("Добавлено в корзину"),
    filledCartOk:
      filledCartText.includes("Корзина") &&
      filledCartText.includes("Товары: 1") &&
      filledCartText.includes("Оформить заказ"),
    checkoutOk:
      checkoutText.includes("Оформление заказа") &&
      checkoutText.includes("Имя") &&
      checkoutText.includes("Телефон") &&
      checkoutText.includes("Подтвердить заказ"),
    emptyCartText,
    toastText,
    filledCartText,
    checkoutText,
    events
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.emptyCartOk || !result.toastOk || !result.filledCartOk || !result.checkoutOk) {
    process.exit(1);
  }
} finally {
  ws.close();
  chrome.kill("SIGTERM");
}
