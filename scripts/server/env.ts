import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ServerEnv = Record<string, string>;

export function loadEnv() {
  const env: ServerEnv = { ...process.env } as ServerEnv;
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return env;
  }

  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!env[key]) {
      env[key] = value;
    }
  }

  return env;
}
