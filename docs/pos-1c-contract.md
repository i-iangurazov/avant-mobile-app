# AVANT plumber loyalty: 1C/POS ingestion contract

Status: pilot boundary, 2026-09-06. This document defines what the application can safely receive. It does not claim that a production 1C/POS integration exists.

## Transport and authorization

The current pilot endpoints are:

- `POST /admin/receipts`
- `POST /admin/returns`

They require a valid application bearer token with the server-side admin capability and are rate limited. A production machine-to-machine integration still needs an agreed authentication mechanism, source IP/network policy, credential rotation, timeout/retry policy, and versioned endpoint. A mobile/public API token must never be used by a till or 1C.

All timestamps are ISO 8601 with an explicit timezone or `Z`. All money fields are decimal strings containing integer minor units (тыйын). Do not send floating-point numbers. `10000` means 100.00 KGS. Quantities are integer thousandths: `1000` means one unit and `500` means half a unit.

## Receipt payload

```json
{
  "externalReceiptId": "POS-BISHKEK-01-20260906-000123",
  "receiptNumber": "000123",
  "storeId": "bishkek-01",
  "storeName": "Авантехник — основной магазин",
  "plumberIdentifier": "AVP-AB12-CD34-EF56",
  "totalMinor": "154990",
  "purchaseAt": "2026-09-06T14:30:00+06:00",
  "source": "1c",
  "items": [
    {
      "externalLineId": "1",
      "productId": "1C-NOMENCLATURE-GUID",
      "productName": "Смеситель",
      "brand": "Brand name",
      "quantityMilli": "1000",
      "unitPriceMinor": "154990",
      "lineTotalMinor": "154990"
    }
  ]
}
```

Rules:

- `externalReceiptId` is globally stable and unique. Repeating the exact event returns success without a second accrual. Reusing it with different content returns conflict.
- `externalLineId` is unique within the receipt and must remain stable for returns.
- `plumberIdentifier` accepts the non-sequential public QR identifier or readable loyalty code. Raw database IDs are rejected as an integration convention and are never encoded in the QR.
- The line totals must equal `totalMinor` exactly.
- The server snapshots the rate, multiplier, exclusions, eligible amount, and calculated bonus on every line. Later rule changes do not rewrite the historical calculation.
- Only an approved plumber can receive a receipt.

## Return payload

```json
{
  "externalReturnId": "POS-RETURN-BISHKEK-01-20260910-000044",
  "externalReceiptId": "POS-BISHKEK-01-20260906-000123",
  "returnAt": "2026-09-10T11:15:00+06:00",
  "source": "1c",
  "items": [
    {
      "externalLineId": "1",
      "quantityMilli": "500",
      "amountMinor": "77495"
    }
  ]
}
```

Rules:

- `externalReturnId` is globally stable and idempotent under the same rules as a receipt.
- Multiple partial returns are allowed. Their cumulative quantity and amount cannot exceed the original line.
- The related base and promotional bonuses are reversed proportionally with integer arithmetic. A return can reverse pending or already available bonuses.
- The system preserves receipt, return, ledger, calculation, and administrator audit records.

## Response and retry contract

A created event returns a `created: true` result. An exact retry returns `created: false` and the existing record. A caller should treat both as accepted. Validation and content conflicts are permanent failures and must be reviewed; network errors and 5xx responses may be retried with the exact same external ID and body.

The application notification outbox is independent of ingestion. Telegram delivery failure never changes whether a receipt or return was accepted.

## Information still required from AVANT / 1C

Before production integration, AVANT and the 1C/POS owner must confirm:

1. 1C version/configuration, POS vendor, integration owner, test environment, and supported protocol.
2. Stable store, receipt, return, receipt-line, product/nomenclature, and brand identifiers.
3. Whether receipts can be edited after fiscalization and how cancellations differ from returns.
4. Exact semantics for discounts, split payments, gift certificates, credit, delivery, bundles, fractional goods, and rounding.
5. Mapping of partial returns and exchanges back to original lines, including cross-store returns.
6. Event delivery order, duplicate/replay behavior, maximum delay, backfill, reconciliation export, and failure alerts.
7. Cashier UX for scanning/typing the loyalty code and validation feedback before receipt close.
8. Production authentication, IP allowlist/VPN, TLS ownership, secret rotation, rate limits, and audit retention.
9. Legal/accounting approval for bonus accrual, release, cancellation, expiration, and personal-data retention.
10. Final rate, level thresholds, eligible/excluded products, promotion stacking, return rounding, and timezone rules.

Until these are answered, the protected admin/manual workflow and development fixtures are the only supported pilot ingestion methods.
