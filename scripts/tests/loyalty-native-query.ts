import assert from "node:assert/strict";
import Module from "node:module";

async function main() {
// Only config/env imports Platform; no React Native implementation runs in Node.
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
const originalLoad = loader._load;
loader._load = function (id, ...args) { return id === "react-native" ? { Platform: { OS: "android" } } : originalLoad.call(this, id, ...args); };
const { appApiClient } = await import("../../src/lib/api/client");
const { getLoyaltyTransactions } = await import("../../src/lib/api/program");
loader._load = originalLoad;
const original = appApiClient.request;
const descriptor = Object.getOwnPropertyDescriptor(URLSearchParams.prototype, "size");
const calls: string[] = [];
try {
  // Match the native runtime that reproduced the defect, without changing its
  // standards-compliant query encoding or .toString().
  Object.defineProperty(URLSearchParams.prototype, "size", { configurable: true, get: () => undefined });
  appApiClient.request = (async (path: string, init?: RequestInit) => {
    const url = new URL(path, "https://isolated.invalid");
    calls.push(path);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-only");
    assert.equal(url.searchParams.get("limit"), "30");
    const filtered = url.searchParams.get("status") === "spent";
    const next = url.searchParams.get("cursor") === "2026-09-21T00:00:00+00:00|fixture";
    return { data: filtered ? [] : [{ id: next ? "older-operation" : "latest-operation" }] };
  }) as typeof appApiClient.request;
  assert.equal((await getLoyaltyTransactions({}, "fixture-only"))[0].id, "latest-operation");
  assert.deepEqual(await getLoyaltyTransactions({ status: "spent" }, "fixture-only"), []);
  assert.equal((await getLoyaltyTransactions({ cursor: "2026-09-21T00:00:00+00:00|fixture" }, "fixture-only"))[0].id, "older-operation");
  assert.equal(new Set(calls).size, 3);
  console.log("PASS: native URLSearchParams without size preserves history limit, empty filtered result, and distinct cursor page.");
} finally {
  appApiClient.request = original;
  if (descriptor) Object.defineProperty(URLSearchParams.prototype, "size", descriptor);
}

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
