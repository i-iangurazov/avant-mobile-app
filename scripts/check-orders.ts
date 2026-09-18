import { registerFixture as registerCustomer, assertTestDatabase } from "./tests/fixtures";
import { randomUUID } from "node:crypto";

import { createPool, ensureSchema } from "./server/db";
import {
  createAppOrder,
  getAppOrder,
  listAppOrders,
  markTelegramSent,
  updateAppOrderStatus
} from "./server/orders";
import {
  formatTelegramOrder,
  isTelegramChatAdmin,
  parseOrderStatusCallback,
  sendOrderToTelegram
} from "./server/telegram";
import { loadEnv } from "./server/env";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const env = loadEnv();
  const pool = createPool(env.DATABASE_URL || "");
  if (!pool) {
    throw new Error("DATABASE_URL is required.");
  }

  const phone = `+99655${Date.now().toString().slice(-7)}`;
  let customerId = "";
  let orderId = "";

  try {
    assertTestDatabase(pool);
    await ensureSchema(pool);
    const account = await registerCustomer(pool, {
      name: "Order Flow QA",
      phone,
      address: "Бишкек",
      password: randomUUID()
    }, "order-flow-test-secret");
    customerId = account.user.id;

    await pool.query("INSERT INTO app_order_branches(organization_id,id,name,address,is_active,orders_enabled) VALUES($1,'store-1','Test branch','Test address',true,true)",[customerId]);
    await pool.query("INSERT INTO app_order_offers(organization_id,branch_id,product_id,product_name,unit_price_minor,stock_quantity,is_active,valid_until) VALUES($1,'store-1','smoke-product','Тестовый смеситель <QA>',150000,10,true,now()+interval '1 hour')",[customerId]);
    const result = await createAppOrder(pool, customerId, {
      clientRequestId: `smoke_${randomUUID().replaceAll("-", "")}`,
      customerName: "Order Flow QA",
      customerPhone: phone,
      deliveryMethod: "pickup",
      storeId: "store-1",
      storeName: "Авантехник Ортосай",
      storeAddress: "Бишкек",
      deliveryAddress: null,
      comment: "Автоматическая проверка — удалить",
      items: [{
        productId: "smoke-product",
        productName: "Тестовый смеситель <QA>",
        quantity: 2,
        unitPrice: 1500,
        unitPriceLabel: null
      }]
    }, {organizationId:customerId});
    assert(result.created && result.order, "Order was not created.");
    const createdOrder = result.order;
    orderId = createdOrder.id;
    assert(createdOrder.total_amount === "3000.00" || Number(createdOrder.total_amount) === 3000, "Order total is incorrect.");

    const telegramPayloads: Array<Record<string, unknown>> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      telegramPayloads.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
      const result = String(input).endsWith("/getChatMember")
        ? { status: "administrator" }
        : { message_id: 4321 };
      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    try {
      const telegramText = formatTelegramOrder(createdOrder);
      assert(telegramText.includes("Тестовый смеситель &lt;QA&gt;"), "Telegram HTML was not escaped.");
      const longTelegramText = formatTelegramOrder({
        ...createdOrder,
        customer_name: "<&>".repeat(200),
        comment: "<&>".repeat(1_000),
        order_items: Array.from({ length: 100 }, (_, index) => ({
          ...createdOrder.order_items[0],
          id: `long-${index}`,
          product_name: "<&>".repeat(200)
        }))
      });
      assert(longTelegramText.length <= 4_000, "Telegram message exceeded the safe length limit.");
      assert(!longTelegramText.endsWith("&"), "Telegram message truncated an HTML entity.");
      const message = await sendOrderToTelegram({ botToken: "test-token", chatId: "-1001" }, createdOrder);
      assert(message.message_id === 4321, "Telegram message response was not handled.");
      assert(
        await isTelegramChatAdmin({ botToken: "test-token", chatId: "-1001" }, 1234),
        "Telegram administrator validation failed."
      );
      await markTelegramSent(pool, orderId, "-1001", message.message_id);
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert(telegramPayloads.length === 2, "Telegram notification/admin checks did not run exactly once.");
    const replyMarkup = telegramPayloads[0].reply_markup as { inline_keyboard?: unknown[] };
    assert(replyMarkup.inline_keyboard?.length === 2, "Initial Telegram status buttons are incorrect.");

    for (const status of ["confirmed", "assembling", "ready_for_pickup", "completed"] as const) {
      const update = await updateAppOrderStatus(pool, orderId, status);
      assert(update.changed, `Status ${status} was not applied.`);
    }

    const detail = await getAppOrder(pool, orderId, customerId);
    assert(detail?.status === "completed", "Final order status is incorrect.");
    assert(detail.order_status_events.length === 5, "Order status audit trail is incomplete.");
    assert(detail.telegram.message_id === 4321, "Telegram message ID was not persisted.");
    const orders = await listAppOrders(pool, customerId);
    assert(orders.length === 1 && orders[0].id === orderId, "Customer order list is incorrect.");
    assert(parseOrderStatusCallback(`o:${orderId}:confirmed`)?.orderId === orderId, "Callback parser rejected a valid callback.");
    assert(parseOrderStatusCallback(`o:${orderId}:hacked`) === null, "Callback parser accepted an invalid status.");

    console.log("Order persistence, Telegram payload, status transitions, ownership, and audit checks passed.");
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM app_orders WHERE id = $1", [orderId]);
    }
    if (customerId) {
      await pool.query("DELETE FROM app_order_offers WHERE organization_id=$1",[customerId]);
      await pool.query("DELETE FROM app_order_branches WHERE organization_id=$1",[customerId]);
      await pool.query("DELETE FROM app_customers WHERE id = $1", [customerId]);
    }
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("Order flow check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
