import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerCustomer, hasAdminAccess } from "./server/auth";
import { createPool, ensureSchema } from "./server/db";
import {
  assignServiceRequest, createLeadReview, createServiceRequest, listLeadCandidates,
  listPlumberLeads, updateLeadByPlumber
} from "./server/leads";
import {
  calculateLevelProgress, createManualAdjustment, getLoyaltyBalances, getLoyaltyConfig,
  ingestReceipt, ingestReturn, redeemReward, releasePendingBonuses, updateLoyaltyConfiguration
} from "./server/loyalty";
import { deliverNotificationOutbox, enqueueNotification } from "./server/notifications";
import {
  applyForPlumber, generatePlumberIdentifiers, requireApprovedPlumber, updatePlumberApplicationStatus
} from "./server/plumbers";

const localDatabaseUrl = process.env.DATABASE_URL || "";
const parsedUrl = new URL(localDatabaseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname)) {
  throw new Error("check:loyalty refuses to mutate a non-local database. Pass the explicit local Docker DATABASE_URL.");
}

const pool = createPool(localDatabaseUrl);
if (!pool) throw new Error("Local DATABASE_URL is required.");

const run = `loyalty-${Date.now()}-${randomUUID().slice(0, 6)}`;
const phoneSuffix = String(Date.now()).slice(-6);
const accounts: string[] = [];
let originalConfig: Awaited<ReturnType<typeof getLoyaltyConfig>> | null = null;

const application = (name: string, district = "Октябрьский") => ({
  fullName: name,
  city: "Бишкек",
  workingDistricts: [district],
  specializations: ["Монтаж сантехники"],
  experienceYears: 7,
  description: "Тестовая анкета интеграционного сценария",
  programConsent: true,
  dataProcessingConsent: true
});

const expectRejected = async (promise: Promise<unknown>, message: string) => {
  const result = await Promise.allSettled([promise]);
  assert.equal(result[0].status, "rejected", message);
};

async function cleanup() {
  if (originalConfig && accounts[0]) {
    await updateLoyaltyConfiguration(pool!, accounts[0], {
      baseRateBps: originalConfig.baseRateBps,
      pendingDays: originalConfig.pendingDays,
      rollingPeriodDays: originalConfig.rollingPeriodDays,
      levels: originalConfig.levels.map((level) => ({ id: level.id, thresholdMinor: level.thresholdMinor, bonusRateBps: level.bonusRateBps }))
    }).catch(() => undefined);
  }
  if (!accounts.length) return;
  const ids = accounts;
  await pool!.query("DELETE FROM app_plumber_reviews WHERE customer_id = ANY($1::text[]) OR plumber_id IN (SELECT id FROM app_plumber_profiles WHERE account_id = ANY($1::text[]))", [ids]);
  await pool!.query("DELETE FROM app_service_requests WHERE customer_id = ANY($1::text[]) OR assigned_plumber_id IN (SELECT id FROM app_plumber_profiles WHERE account_id = ANY($1::text[]))", [ids]);
  await pool!.query("DELETE FROM app_loyalty_transactions WHERE plumber_id IN (SELECT id FROM app_plumber_profiles WHERE account_id = ANY($1::text[]))", [ids]);
  await pool!.query("DELETE FROM app_loyalty_returns WHERE receipt_id IN (SELECT receipts.id FROM app_loyalty_receipts receipts JOIN app_plumber_profiles plumbers ON plumbers.id = receipts.plumber_id WHERE plumbers.account_id = ANY($1::text[]))", [ids]);
  await pool!.query("DELETE FROM app_loyalty_receipts WHERE plumber_id IN (SELECT id FROM app_plumber_profiles WHERE account_id = ANY($1::text[]))", [ids]);
  await pool!.query("DELETE FROM app_reward_redemptions WHERE plumber_id IN (SELECT id FROM app_plumber_profiles WHERE account_id = ANY($1::text[]))", [ids]);
  await pool!.query("DELETE FROM app_rewards WHERE created_by = ANY($1::text[])", [ids]);
  await pool!.query("DELETE FROM app_loyalty_promotions WHERE created_by = ANY($1::text[])", [ids]);
  await pool!.query("DELETE FROM app_admin_audit_log WHERE actor_id = ANY($1::text[])", [ids]);
  await pool!.query("DELETE FROM app_notification_outbox WHERE dedupe_key LIKE $1", [`%${run}%`]);
  await pool!.query("DELETE FROM app_customers WHERE id = ANY($1::text[])", [ids]);
}

async function main() {
  await ensureSchema(pool!);
  originalConfig = await getLoyaltyConfig(pool!);
  const secret = `test-secret-${run}`;

  const customerResult = await registerCustomer(pool!, {
    name: "Тестовый покупатель",
    phone: `+996700${phoneSuffix}`,
    password: "StrongPass123",
    accountType: "customer"
  }, secret);
  const customer = customerResult.user;
  accounts.push(customer.id);
  assert.equal(customer.accountType, "customer");
  assert.equal(customer.plumber, null);

  const existingApplication = await applyForPlumber(pool!, customer.id, application("Покупатель-Сантехник"));
  assert.equal(existingApplication?.applicationStatus, "pending", "an existing customer can apply without a second account");
  await expectRejected(requireApprovedPlumber(pool!, customer.id), "pending plumber must not receive benefits");

  const plumberResult = await registerCustomer(pool!, {
    name: "Тестовый мастер A",
    phone: `+996701${phoneSuffix}`,
    password: "StrongPass123",
    accountType: "plumber",
    plumberApplication: application("Тестовый мастер A")
  }, secret);
  const plumberAccount = plumberResult.user;
  accounts.push(plumberAccount.id);
  assert.equal(plumberAccount.plumber?.applicationStatus, "pending", "plumber registration creates a pending application");

  await expectRejected(registerCustomer(pool!, {
    name: "Дубликат", phone: plumberAccount.phone, password: "StrongPass123", accountType: "customer"
  }, secret), "one normalized phone must not create duplicate accounts");
  await expectRejected(registerCustomer(pool!, {
    name: "Лишние цифры", phone: `${plumberAccount.phone}99`, password: "StrongPass123", accountType: "customer"
  }, secret), "phone normalization must reject rather than truncate extra digits");

  const plumberBResult = await registerCustomer(pool!, {
    name: "Тестовый мастер B",
    phone: `+996702${phoneSuffix}`,
    password: "StrongPass123",
    accountType: "plumber",
    plumberApplication: application("Тестовый мастер B", "Ленинский")
  }, secret);
  accounts.push(plumberBResult.user.id);

  await pool!.query("INSERT INTO app_account_roles (account_id, role, is_active) VALUES ($1, 'admin', true) ON CONFLICT (account_id, role) DO UPDATE SET is_active = true", [customer.id]);
  assert.equal(await hasAdminAccess(pool!, customer.id), true, "admin authorization role is enforced server-side");

  const plumberAId = plumberAccount.plumber!.id;
  await updatePlumberApplicationStatus(pool!, customer.id, plumberAId, "rejected", "Нужно подтвердить данные");
  await expectRejected(requireApprovedPlumber(pool!, plumberAccount.id), "rejected plumber must not receive benefits");
  const resubmitted = await applyForPlumber(pool!, plumberAccount.id, application("Тестовый мастер A"));
  assert.equal(resubmitted?.applicationStatus, "pending");
  await updatePlumberApplicationStatus(pool!, customer.id, plumberAId, "approved", null);
  await updatePlumberApplicationStatus(pool!, customer.id, plumberBResult.user.plumber!.id, "approved", null);
  const approvedA = await requireApprovedPlumber(pool!, plumberAccount.id);
  const approvedB = await requireApprovedPlumber(pool!, plumberBResult.user.id);

  const firstQr = generatePlumberIdentifiers();
  const secondQr = generatePlumberIdentifiers();
  assert.notEqual(firstQr.publicId, secondQr.publicId);
  assert.match(firstQr.qrPayload, /^AVANT:PLUMBER:[A-Za-z0-9_-]{20,}$/);
  assert.equal(firstQr.qrPayload.includes(plumberAId), false, "QR never exposes a database ID");
  assert.equal(`AVANT:PLUMBER:${approvedA.publicId}`.includes(plumberAId), false);

  await updateLoyaltyConfiguration(pool!, customer.id, {
    baseRateBps: 100,
    pendingDays: 14,
    rollingPeriodDays: 90,
    levels: originalConfig.levels.map((level, index) => ({
      id: level.id,
      thresholdMinor: index === 0 ? "0" : index === 1 ? "30000" : "1000000",
      bonusRateBps: level.bonusRateBps
    }))
  });
  await pool!.query(
    `INSERT INTO app_loyalty_promotions (id, title, scope_type, scope_value, multiplier_bps, starts_at, ends_at, created_by)
     VALUES ($1, 'Тест x3', 'brand', 'TestBrand', 30000, now() - interval '1 day', now() + interval '1 day', $2)`,
    [`promo-${run}`, customer.id]
  );

  const receiptInput = {
    externalReceiptId: `receipt-${run}`,
    receiptNumber: `R-${phoneSuffix}`,
    storeId: "store-test",
    storeName: "Тестовый магазин",
    plumberIdentifier: approvedA.loyaltyCode,
    totalMinor: "100000",
    purchaseAt: new Date().toISOString(),
    source: "fixture" as const,
    items: [
      { externalLineId: "normal", productId: "p-normal", productName: "Обычный товар", brand: "Other", quantityMilli: "1000", unitPriceMinor: "40000", lineTotalMinor: "40000" },
      { externalLineId: "promo", productId: "p-promo", productName: "Товар x3", brand: "TestBrand", quantityMilli: "1000", unitPriceMinor: "60000", lineTotalMinor: "60000" }
    ]
  };
  const firstReceipt = await ingestReceipt(pool!, receiptInput, customer.id);
  const duplicateReceipt = await ingestReceipt(pool!, receiptInput, customer.id);
  assert.equal(firstReceipt.created, true);
  assert.equal(duplicateReceipt.created, false, "same external receipt is idempotent");
  const transactionAmounts = await pool!.query<{ transaction_type: string; amount_minor: string }>(
    "SELECT transaction_type, amount_minor::text FROM app_loyalty_transactions WHERE receipt_id = $1 ORDER BY transaction_type",
    [(firstReceipt.receipt as { id: string }).id]
  );
  assert.deepEqual(Object.fromEntries(transactionAmounts.rows.map((row) => [row.transaction_type, row.amount_minor])), {
    promotional_multiplier: "1200",
    purchase_accrual: "1000"
  }, "1% base and x3 promotional increment use integer arithmetic");
  assert.equal((await getLoyaltyBalances(pool!, approvedA.id)).pendingMinor, "2200");

  const partialReturn = await ingestReturn(pool!, {
    externalReturnId: `return-part-${run}`,
    externalReceiptId: receiptInput.externalReceiptId,
    returnAt: new Date().toISOString(), source: "fixture",
    items: [{ externalLineId: "promo", quantityMilli: "500", amountMinor: "30000" }]
  }, customer.id);
  assert.equal(partialReturn.created, true);
  const duplicateReturn = await ingestReturn(pool!, {
    externalReturnId: `return-part-${run}`,
    externalReceiptId: receiptInput.externalReceiptId,
    returnAt: (await pool!.query<{ return_at: string }>("SELECT return_at::text FROM app_loyalty_returns WHERE external_return_id = $1", [`return-part-${run}`])).rows[0].return_at,
    source: "fixture",
    items: [{ externalLineId: "promo", quantityMilli: "500", amountMinor: "30000" }]
  }, customer.id);
  assert.equal(duplicateReturn.created, false, "same return event is idempotent");
  await ingestReturn(pool!, {
    externalReturnId: `return-rest-${run}`, externalReceiptId: receiptInput.externalReceiptId,
    returnAt: new Date().toISOString(), source: "fixture",
    items: [{ externalLineId: "promo", quantityMilli: "500", amountMinor: "30000" }]
  }, customer.id);
  assert.equal((await getLoyaltyBalances(pool!, approvedA.id)).pendingMinor, "400", "partial plus full line return reverses exact related bonus");

  await pool!.query("UPDATE app_loyalty_transactions SET available_at = now() - interval '1 second' WHERE plumber_id = $1 AND status = 'pending'", [approvedA.id]);
  assert.equal(await releasePendingBonuses(pool!, approvedA.id), 2, "both base and multiplier accruals become available");
  assert.equal((await getLoyaltyBalances(pool!, approvedA.id)).availableMinor, "400");
  const level = await calculateLevelProgress(pool!, approvedA.id);
  assert.equal(level.current.code, "expert", "rolling eligible purchases determine level after returns");

  await pool!.query(
    `INSERT INTO app_rewards (id, title, description, cost_minor, availability_count, created_by)
     VALUES ($1, 'Тестовая награда', 'Только для интеграционного теста', 300, 5, $2)`,
    [`reward-${run}`, customer.id]
  );
  const redemptionRace = await Promise.allSettled([
    redeemReward(pool!, plumberAccount.id, `reward-${run}`, `redeem-a-${run}`),
    redeemReward(pool!, plumberAccount.id, `reward-${run}`, `redeem-b-${run}`)
  ]);
  assert.equal(redemptionRace.filter((result) => result.status === "fulfilled").length, 1, "atomic lock permits only one spend when balance covers one reward");
  assert.equal(redemptionRace.filter((result) => result.status === "rejected").length, 1);
  await expectRejected(redeemReward(pool!, plumberAccount.id, `reward-${run}`, `redeem-insufficient-${run}`), "insufficient balance is rejected");

  const lead = await createServiceRequest(pool!, customer.id, {
    serviceType: "Монтаж сантехники", description: "Нужно установить новый смеситель на кухне", district: "Октябрьский",
    address: "Точный тестовый адрес", phone: customer.phone, consentToShare: true
  });
  const candidateList = await listLeadCandidates(pool!, lead.id);
  assert.equal(candidateList[0]?.id, approvedA.id, "district and specialization matching ranks the appropriate plumber first");
  await assignServiceRequest(pool!, customer.id, lead.id, approvedA.id);
  assert.equal((await assignServiceRequest(pool!, customer.id, lead.id, approvedA.id)).assigned, false, "repeated assignment is idempotent");
  const beforeAccept = (await listPlumberLeads(pool!, plumberAccount.id)).find((item) => item.id === lead.id)!;
  assert.equal(beforeAccept.contact, null, "private contact is hidden before acceptance");
  assert.equal((await listPlumberLeads(pool!, plumberBResult.user.id)).some((item) => item.id === lead.id), false, "another plumber cannot see the exclusive lead");
  await expectRejected(updateLeadByPlumber(pool!, plumberBResult.user.id, lead.id, "accepted"), "another plumber cannot accept the exclusive lead");
  const acceptRace = await Promise.allSettled([
    updateLeadByPlumber(pool!, plumberAccount.id, lead.id, "accepted"),
    updateLeadByPlumber(pool!, plumberAccount.id, lead.id, "accepted")
  ]);
  assert.equal(acceptRace.filter((result) => result.status === "fulfilled").length, 2, "repeat acceptance is safe and idempotent");
  const afterAccept = (await listPlumberLeads(pool!, plumberAccount.id)).find((item) => item.id === lead.id)!;
  assert.equal(afterAccept.contact?.phone, customer.phone, "private contact opens only to the assigned plumber after acceptance");
  await updateLeadByPlumber(pool!, plumberAccount.id, lead.id, "in_progress");
  await updateLeadByPlumber(pool!, plumberAccount.id, lead.id, "completed");
  await createLeadReview(pool!, customer.id, lead.id, { rating: 5, review: "Работа выполнена отлично", tags: ["Аккуратно"] });
  await expectRejected(createLeadReview(pool!, customer.id, lead.id, { rating: 4 }), "only one review is allowed per completed lead");

  const dedupeA = await enqueueNotification(pool!, { targetChatId: "999999", eventType: "test.dedupe", dedupeKey: `notification-dedupe-${run}`, text: "Безопасный тест" });
  const dedupeB = await enqueueNotification(pool!, { targetChatId: "999999", eventType: "test.dedupe", dedupeKey: `notification-dedupe-${run}`, text: "Безопасный тест" });
  assert.equal(dedupeA.created, true); assert.equal(dedupeB.created, false, "notification outbox deduplicates events");
  const failing = await enqueueNotification(pool!, { targetChatId: "999999", eventType: "test.failure", dedupeKey: `notification-failure-${run}`, text: "Безопасный тест отказа" });
  await deliverNotificationOutbox(pool!, async () => { throw new Error("simulated Telegram outage"); }, 500);
  const failureStatus = await pool!.query<{ status: string; attempts: number }>("SELECT status, attempts FROM app_notification_outbox WHERE id = $1", [failing.id]);
  assert.deepEqual(failureStatus.rows[0], { status: "failed", attempts: 1 }, "Telegram outage is stored for retry and does not fail domain operations");

  await createManualAdjustment(pool!, customer.id, approvedB.id, 100, `Тестовая причина ${run}`);
  console.log("Loyalty integration check passed: 29 assertions across auth, QR, ledger, returns, levels, rewards, leads, reviews, authorization and Telegram retry safety.");
}

void main()
  .then(async () => { await cleanup(); await pool!.end(); })
  .catch(async (error) => { console.error("Loyalty integration check failed:", error); await cleanup().catch(() => undefined); await pool!.end(); process.exit(1); });
