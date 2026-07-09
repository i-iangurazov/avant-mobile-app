# Авантехник Mobile

Expo React Native app for the Авантехник mobile commerce experience in Bishkek. UI language is Russian. Catalog, products, checkout, and orders are wired through the Bazaar API layer in `src/lib/bazaar`.

## Install

```bash
npm install
cp .env.example .env
```

Fill `.env` with real local values. Never commit a real Bazaar token.

## Run

```bash
npm run start
npm run ios
npm run android
```

For Expo Web:

```bash
npm run start -- --web
```

## Local Bazaar Proxy

For local testing without exposing `BAZAAR_API_TOKEN` in the Expo bundle:

```bash
npm run dev:all
```

This starts Docker Postgres, the Bazaar/app proxy, and Expo together. It also passes the proxy URLs to Expo automatically. If you already use another database, set `SKIP_DB_START=1` and point `DATABASE_URL` at that database.

For Expo Web with the local proxy:

```bash
npm run dev:all -- --web
```

Manual mode:

```bash
npm run db:up
npm run dev:proxy
npm run start
```

Then set the mobile app to the proxy URL:

```bash
EXPO_PUBLIC_BAZAAR_PROXY_URL=http://YOUR_COMPUTER_LAN_IP:8787
EXPO_PUBLIC_BAZAAR_PROXY_URL_WEB=http://127.0.0.1:8787
```

Use your Mac LAN IP for Expo Go on a phone, for example `http://192.168.x.x:8787`. Use `http://127.0.0.1:8787` for Expo Web on the same Mac. The phone and Mac must be on the same Wi-Fi. For production, use the deployed HTTPS proxy.

Current Railway production proxy:

```bash
EXPO_PUBLIC_BAZAAR_PROXY_URL=https://api-production-2e6d.up.railway.app
```

## Environment

Public mobile values:

- `EXPO_PUBLIC_APP_NAME`
- `EXPO_PUBLIC_WHATSAPP_BUSINESS_PHONE`
- `NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE` as an optional alias
- `EXPO_PUBLIC_2GIS_SEARCH_URL`
- `EXPO_PUBLIC_BAZAAR_PROXY_URL` - public URL of your secure Bazaar proxy
- `EXPO_PUBLIC_BAZAAR_PROXY_URL_WEB` - optional local browser override

Server-side/check values:

- `BAZAAR_API_BASE_URL`
- `BAZAAR_API_TOKEN`
- `DATABASE_URL`
- `AUTH_TOKEN_SECRET`

Expo only guarantees `EXPO_PUBLIC_*` variables inside the mobile bundle. Direct mobile calls to Bazaar with a private `BAZAAR_API_TOKEN` are not a secure production architecture because any token available to the app can be extracted from the bundle. Set `EXPO_PUBLIC_BAZAAR_PROXY_URL` to a secure proxy that stores `BAZAAR_API_TOKEN` server-side.

Customer login, registration, and profile are handled by the Avantehnik app backend using Postgres. The mobile app never connects to Postgres directly.

## Bazaar API Layer

Central files:

- `src/lib/bazaar/client.ts`
- `src/lib/bazaar/endpoints.ts`
- `src/lib/bazaar/adapters.ts`
- `src/lib/bazaar/types.ts`
- `src/lib/errors/normalizeApiError.ts`

Current endpoint assumptions:

- Products: `GET /products`
- Product detail: `GET /products?id=:id`
- Categories: `GET /categories`; if Bazaar returns 404, the app builds storefront categories from real Bazaar `/products?search=...` results and uses live `total` counts
- Login: `POST /auth/login`, app backend/Postgres
- Registration: `POST /auth/register`, app backend/Postgres
- Profile: `GET/PATCH /profile`, app backend/Postgres
- Orders: `GET/POST /orders`, Bazaar API. Order creation uses the official `POST /orders` schema:
  - `externalId`
  - `customerName`
  - `customerPhone`
  - `customerAddress`
  - `comment`
  - `lines[].productId`
  - `lines[].qty`

If an order endpoint is not found, the app reports that explicitly instead of faking success.

## 2GIS

`src/components/maps/TwoGisMap.tsx` embeds the 2GIS firmsonmap widget with `react-native-webview`. If WebView fails, the map card shows retry and “Открыть в 2GIS”. Store cards use the six real Bishkek addresses in `src/data/stores.ts`.

## What Is Local

- Cart is persisted locally with AsyncStorage as a temporary basket.
- Photo search currently accepts camera/gallery input and offers WhatsApp support. Automatic visual matching is disabled unless `EXPO_PUBLIC_IMAGE_SEARCH_ENABLED=true` and a real `EXPO_PUBLIC_IMAGE_SEARCH_URL` recognition endpoint is configured.
- Store addresses are static business data.

No production catalog, product, or order screen uses local JSON fixtures as a data source.

Real Taobao/Pinduoduo-style image search still requires:

- real product photos in the catalog
- an image-recognition/vector-search backend endpoint
- product-image embeddings or a commercial vision API
- server-side API keys and storage for uploaded images
- a response that returns matching Bazaar product IDs

## Checks

```bash
npm run typecheck
npm run lint
npm run check:bazaar
npm run check:db
npm run smoke
```

`check:bazaar` reads `.env`, prints only sanitized status, and does not create orders. `check:db` verifies the app customer database and creates the schema if needed.

## EAS Build

`app.json` contains:

- App name: `Авантехник`
- iOS bundle id: `kg.avantehnik.app`
- Android package: `kg.avantehnik.app`
- Camera/photo permissions for image search
- Icon and splash assets

Build later with:

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

Before a real production submission, deploy a secure server-side Bazaar proxy or get a public customer-safe Bazaar API credential.
