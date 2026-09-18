# Авантехник Mobile

Expo React Native commerce app for Авантехник in Bishkek. The interface is in Russian.

## Runtime architecture

- Customer registration, login, profiles, orders, order items, and order status history are stored in the app Postgres database.
- A new order is sent to the configured Telegram admin group with inline status buttons.
- Telegram status changes are authenticated by Telegram's webhook secret, restricted to the configured chat, persisted to Postgres, and shown in the app on its next automatic refresh.
- Orders are not read from or written to Bazaar. The server does not expose any Bazaar order route.
- The product/category catalog is still read-only from the existing Bazaar catalog API. The proxy rejects every non-GET catalog request. A separate catalog source is required before the app can have zero Bazaar runtime dependency.
- The cart remains local to the device until checkout.

Supported order flow:

`Заказ создан → Подтверждён → Собирается → Готов к выдаче / В пути → Завершён`

An administrator can cancel a non-terminal order from Telegram. Every change produces an audit event.

## Install and run

```bash
npm install
cp .env.example .env
npm run dev:all
```

`dev:all` starts the project Postgres container, the Avantehnik app server, and Expo. For a database that is already running:

```bash
SKIP_DB_START=1 npm run dev:all
```

Manual mode:

```bash
npm run db:up
npm run dev:server
npm run start
```

Expo Go needs the computer's LAN address, while Expo Web can use loopback:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:8787
EXPO_PUBLIC_API_URL_WEB=http://127.0.0.1:8787
```

The app temporarily accepts the old `EXPO_PUBLIC_BAZAAR_PROXY_URL` variable so already-configured builds can migrate safely. New environments should use `EXPO_PUBLIC_API_URL`.

## Environment

Public mobile values:

- `EXPO_PUBLIC_APP_NAME`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_API_URL_WEB` for local web development
- `EXPO_PUBLIC_WHATSAPP_BUSINESS_PHONE`
- `EXPO_PUBLIC_2GIS_SEARCH_URL`
- optional image-search settings

Server-only values:

- `DATABASE_URL`
- `AUTH_TOKEN_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_BOT_USERNAME` for the one-tap secure Telegram linking flow
- `SMS_PROVIDER_URL` / `SMS_PROVIDER_TOKEN` for server-bound phone verification
- `APP_ORGANIZATION_ID` / `DELIVERY_BRANCH_ID` for trusted inventory context
- `MEDIA_PROVIDER_URL` / `MEDIA_PROVIDER_TOKEN` / `MEDIA_PUBLIC_HOST` for owned attachments
- `ACCOUNT_DELETION_MODE`, enabled only after approved retention/deletion policy
- `TELEGRAM_WEBHOOK_URL` when not hosted on Railway
- optional `TELEGRAM_WEBHOOK_SECRET`
- `BAZAAR_API_BASE_URL` and `BAZAAR_API_TOKEN` only for the current read-only catalog

Never expose database, Telegram, auth, or catalog secrets with an `EXPO_PUBLIC_` prefix. Local `.env` files are gitignored. The same server-only values must be configured in Railway; adding them only to a local `.env` does not configure production.

On Railway, the server derives the webhook URL from `RAILWAY_PUBLIC_DOMAIN` and registers it at startup. Other hosts must provide the full HTTPS URL ending in `/telegram/webhook`.

## Local checks before production review

Use a disposable local database and isolated adapters. These commands can write fixtures or apply schema; they are not production preflight commands. Reviewed migration, backup, rollout and rollback steps are in [the remediation deployment plan](docs/production-readiness/2026-09-18-remediation/DEPLOYMENT.md).

```bash
npm run typecheck
npm run lint
npm run check:db
npm run check:orders
npm run check:loyalty
npm run check:telegram
npm run check:catalog
```

- `check:db` applies the idempotent schema and verifies account, order, plumber, loyalty, lead, and notification tables.
- `check:orders` creates and removes isolated QA records, mocks Telegram delivery, and verifies ownership, totals, buttons, transitions, and audit history.
- `check:loyalty` runs only against localhost and validates registration/application statuses, secure QR identifiers, receipt/return idempotency, integer bonus calculations, levels, concurrent reward redemption, lead privacy/acceptance, reviews, authorization, and Telegram retry safety.
- `check:telegram` validates the bot and admin chat without sending a message.
- `check:catalog` performs read-only product/category requests.

After deployment, `/health` must return HTTP 200 with `ok: true`. A production server refuses to start with a placeholder auth secret or without Telegram/webhook configuration.

## EAS release

The identifiers are `kg.avantehnik.app` for both iOS and Android. Production build numbers auto-increment.

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

Before submission, also confirm the App Store/Google Play privacy policy, support URL, screenshots, data-safety answers, account-deletion policy, and reviewer test credentials. Those store-console assets are not contained in this repository.

## Plumber loyalty program

The customer application now uses one identity with additive customer, plumber, and admin capabilities. A new user can select `Покупатель` or `Сантехник`; an existing customer can submit the same plumber application without creating another account. Pending, rejected, and suspended profiles keep all customer functionality, while the professional workspace is limited to approved plumbers.

The pilot includes:

- administrator verification with status history and audit records;
- a professional five-tab navigation, dashboard, level progress, secure QR/loyalty code, history, rewards, content, reviews, and Telegram preferences;
- an auditable integer ledger with pending/available/spent/reversed states, configurable 1% base rate, x2/x3 rules, exclusions, configurable 14-day pending period, idempotent receipt ingestion, and partial/full return reversal;
- configurable rolling levels (`Профи`, `Эксперт`, `Мастер`), stored in database configuration rather than application constants;
- safe reward redemption with row locking, balance revalidation, idempotency, and administrator processing;
- customer plumber requests with controlled administrator assignment, privacy-gated contact details, atomic exclusive acceptance, status history, and one review per completed request;
- plumber reservations that reuse the existing cart, product, store, order, and Telegram order flow and explicitly remain separate from payment;
- retry-safe, deduplicated Telegram notification outbox and a short-lived one-time account-link token. Telegram outages never roll back a purchase, receipt, lead, or reward operation.

No Telegram Mini App or separate plumber authentication system is used.

The protected 1C/POS boundary and unresolved production decisions are documented in [`docs/pos-1c-contract.md`](docs/pos-1c-contract.md). Until AVANT provides a real POS/1C API, administrators can use the protected one-line manual receipt/return pilot form. It is not a substitute for the production integration.

### Important pre-production decisions

- Confirm financial thresholds, benefits, reward values, pending period, and promotion/exclusion policy. Seeded values are editable pilot defaults, not approved commercial terms.
- Review existing privileged accounts, then use audited database roles by verified account ID. `ADMIN_PHONE_NUMBERS` is ignored and never grants access. Coordinate auth v2 migration and session revocation using the deployment plan; configure `TELEGRAM_BOT_USERNAME` separately.
- Provide the bot username and start a private chat before linking. The admin group chat ID used for order operations is not a customer account link.
- Connect and verify the media adapter for system-picker uploads, decoding, metadata stripping, ownership and deletion. Client-supplied external URLs are not proof of attachment ownership.
- The current customer catalogue remains a read-only legacy Bazaar source. Orders, reservations, loyalty, accounts, and leads never write to Bazaar. Removing Bazaar entirely requires AVANT's replacement catalogue/inventory API or a data migration plan; disabling it now would break the existing catalogue, search, filters, and product pages.
- Review and approve the account-deletion flow, program rules/privacy wording, store-console privacy answers, screenshots, reviewer account, and support/privacy-policy URLs before App Store or Google Play submission.

### Local loyalty check

The loyalty integration check refuses any database whose hostname is not localhost:

```bash
DATABASE_URL=postgresql://avantehnik:avantehnik_dev_password@127.0.0.1:5438/avantehnik npm run check:loyalty
```

## Production readiness remediation

The immutable baseline and the [remediation report](docs/production-readiness/2026-09-18-remediation/REPORT.md) distinguish local/API/web evidence from unverified native release and external-service gates. Both stores remain NO-GO. No production deployment is part of these changes.
