import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number(process.env.CDP_PORT || 9368);
const appUrl = process.argv[2] || "http://localhost:8081/orders/cmqxncc8q0002oxise00rha02";
const screenshotPath = process.argv[3] || "/tmp/avantehnik-order-detail-smoke.png";
const profileDir = `/tmp/avantehnik-cdp-order-${Date.now()}`;
const windowSize = process.env.WINDOW_SIZE || "390,844";
const session = JSON.stringify({
  accessToken: "visual-smoke",
  refreshToken: null,
  user: {
    id: "visual-smoke-user",
    name: "QA",
    phone: "+996500991966",
    address: "Бишкек"
  }
});

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
  "about:blank"
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

  if (message.method === "Network.responseReceived") {
    const response = message.params.response;
    if (response.url.includes(":8787") || response.url.includes("/orders")) {
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

try {
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: "http://localhost:8081" });
  await delay(2500);
  await send("Runtime.evaluate", {
    expression: `
      localStorage.setItem("avantehnik:bazaar-session:v1", ${JSON.stringify(session)});
      localStorage.setItem("AsyncStorage:avantehnik:bazaar-session:v1", ${JSON.stringify(session)});
    `,
    returnByValue: true
  });
  await send("Page.navigate", { url: appUrl });
  await delay(Number(process.env.VISUAL_WAIT_MS || 12000));

  const bodyText = await send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true
  });
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.result.data, "base64"));

  console.log(JSON.stringify(
    {
      url: appUrl,
      screenshotPath,
      bodyText: bodyText.result.result.value,
      events
    },
    null,
    2
  ));
} finally {
  ws.close();
  chrome.kill("SIGTERM");
}
