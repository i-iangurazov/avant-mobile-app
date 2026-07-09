import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";

const getLanIp = () => {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return "127.0.0.1";
};

const lanIp = process.env.DEV_LAN_IP || getLanIp();
const proxyPort = process.env.BAZAAR_PROXY_PORT || "8787";
const proxyUrl = process.env.EXPO_PUBLIC_BAZAAR_PROXY_URL || `http://${lanIp}:${proxyPort}`;
const proxyUrlWeb = process.env.EXPO_PUBLIC_BAZAAR_PROXY_URL_WEB || `http://127.0.0.1:${proxyPort}`;
const expoArgs = ["expo", "start", "--clear", ...process.argv.slice(2)];
const children: ChildProcess[] = [];

const isPortAvailable = (portNumber: number) =>
  new Promise<boolean>((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(portNumber, "0.0.0.0");
  });

const start = (name: string, command: string, args: string[], env: NodeJS.ProcessEnv) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    env
  });

  children.push(child);

  child.on("exit", (code) => {
    if (code && !shuttingDown) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });
};

let shuttingDown = false;

const shutdown = (code = 0) => {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }
  setTimeout(() => process.exit(code), 250);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const main = async () => {
  console.log(`Using Bazaar proxy URL for Expo Go: ${proxyUrl}`);
  console.log(`Using Bazaar proxy URL for Expo Web: ${proxyUrlWeb}`);

  const numericProxyPort = Number(proxyPort);
  if (!Number.isFinite(numericProxyPort) || numericProxyPort <= 0) {
    console.error(`Invalid BAZAAR_PROXY_PORT: ${proxyPort}`);
    process.exit(1);
  }

  if (!(await isPortAvailable(numericProxyPort))) {
    console.error(`Port ${proxyPort} is already in use.`);
    console.error(`Run: lsof -i :${proxyPort}`);
    console.error("Stop the old dev server with Ctrl-C, or run: kill <PID>");
    console.error(`Alternative: BAZAAR_PROXY_PORT=8788 npm run dev:all -- --web`);
    process.exit(1);
  }

  if (process.env.SKIP_DB_START !== "1") {
    console.log("Starting local Postgres...");
    const db = spawnSync("docker", ["compose", "up", "-d", "postgres"], {
      stdio: "inherit",
      env: process.env
    });

    if (db.status) {
      console.error("Could not start local Postgres. Start Docker Desktop or set SKIP_DB_START=1 if using another DATABASE_URL.");
      process.exit(db.status);
    }
  }

  console.log("Starting Bazaar proxy and Expo...");

  start("bazaar-proxy", "npx", ["tsx", "scripts/bazaar-proxy.ts"], {
    ...process.env,
    BAZAAR_PROXY_HOST: process.env.BAZAAR_PROXY_HOST || "0.0.0.0",
    BAZAAR_PROXY_PORT: proxyPort
  });

  start("expo", "npx", expoArgs, {
    ...process.env,
    EXPO_PUBLIC_BAZAAR_PROXY_URL: proxyUrl,
    EXPO_PUBLIC_BAZAAR_PROXY_URL_WEB: proxyUrlWeb
  });
};

void main();
