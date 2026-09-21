import assert from "node:assert/strict";
import { authDestination, authReturnTo } from "../../src/lib/navigation/authDestination";

for (const unsafe of ["https://example.com", "//example.com", "/\\example.com", "/login", "/register", "/checkout?returnTo=https://example.com", "/%2fexample.com", ["/checkout"], null]) {
  assert.equal(authReturnTo(unsafe), undefined);
  assert.equal(authDestination(unsafe), "/catalog");
}
for (const route of ["/checkout", "/checkout?mode=reservation", "/find-plumber", "/orders", "/plumber/qr", "/plumber/apply"]) {
  assert.equal(authDestination(route), route);
  assert.equal(authDestination(route, true), route);
}
assert.equal(authDestination(undefined, true), "/plumber-home");
assert.equal(authDestination(undefined), "/catalog");
console.log("PASS: auth destinations preserve six entry flows, reject nine unsafe/loop destinations, and keep role defaults.");
