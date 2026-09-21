// Only application routes that explicitly ask for authentication may be resumed.
// A deep link must never turn returnTo into an external URL or an auth loop.
const destinations = new Set([
  "/catalog", "/cart", "/checkout", "/checkout?mode=reservation",
  "/find-plumber", "/orders", "/profile", "/plumber/apply", "/plumber/qr"
]);

export function authReturnTo(value: unknown): string | undefined {
  return typeof value === "string" && destinations.has(value) ? value : undefined;
}

export function authDestination(value: unknown, approvedPlumber = false): string {
  return authReturnTo(value) ?? (approvedPlumber ? "/plumber-home" : "/catalog");
}
