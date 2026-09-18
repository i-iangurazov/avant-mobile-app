# Повторные проверки и воспроизведение

Source9a7b421, веткаmain, Node22.18.0. Только изолированная БД `postgresql://audit@127.0.0.1:55448/remediation`; fixtures отказываются работать с другой средой. Baseline и предыдущий отчёт не изменены. Все PATH/PORT в командах — локальные тестовые значения, production credentials не нужны.

|Проверка|Фактическое доказательство|
|---|---|
|Прежний набор135 assertions/checks|[regression-suite.log](evidence/regression-suite.log)|
|Catalog gateway,12 групп|[catalog-gateway.json](evidence/catalog-gateway.json)|
|Реальный GET2365 SKU через новый gateway|[gateway-real-source.json](evidence/gateway-real-source.json)|
|Полное наполнение/пустые поля|[summary](evidence/catalog-complete-readonly.json),[capture](evidence/catalog-capture.json.gz),[flags](evidence/catalog-field-coverage.json)|
|D22 reproduction на6c40f51|[D22-before.json](evidence/D22-before.json)|
|D23 воспроизведение, reload/concurrency/storage/account|[reward-retry.json](evidence/reward-retry.json)|
|Карта/каталог10webсостояний|[visual.json](evidence/visual.json),[второй исходный филиал](evidence/visual-second-branch.json)|
|Награды6web/APIсценариев, потеря201 послеCOMMIT|[reward-ui.json](evidence/reward-ui.json)|
|Типы/lint|[typecheck.log](evidence/typecheck.log),[lint.log](evidence/lint.log)|
|Android/iOS Hermes и web|[export-all.log](evidence/export-all.log),[hashes](evidence/builds.json)|
|Native ограничения|[native-environment.json](evidence/native-environment.json)|

После запуска отдельной PostgreSQL16 на55448 и создания БДremediation:

```sh
export PATH=/Users/ilias_iangurazov/.nvm/versions/node/v22.18.0/bin:$PATH
export TEST_DATABASE_URL=postgresql://audit@127.0.0.1:55448/remediation
npm run typecheck
npm run lint
npm run check:remediation
python3 -c 'import gzip,pathlib; pathlib.Path("/private/tmp/avantehnik-full-catalog.json").write_bytes(gzip.open("docs/production-readiness/2026-09-18-followup/evidence/catalog-capture.json.gz","rb").read())'
CATALOG_CAPTURE=/private/tmp/avantehnik-full-catalog.json node --import tsx scripts/tests/catalog-gateway.ts
node --import tsx scripts/tests/catalog-readonly.ts # только public GET, актуальные данные могут измениться
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:8789 npx expo export --platform all --output-dir /private/tmp/avantehnik-remediation-export
```

`npm run check:remediation` теперь включает и новые catalog/reward regression; основной135-пунктовый набор и новые сценарии запускались отдельно при разработке. В CI добавлены те же скрипты, удалённый CI здесь не запускался.

Для карты/каталога: `node scripts/tests/static-export.mjs` на8090 и `CATALOG_CAPTURE=... node --import tsx scripts/tests/followup-catalog-server.ts` на8789. Затем `node scripts/tests/followup-visual.mjs`. Карта тестируется обычным headed Chrome с реальными tiles; без массовой загрузки карт. `visual.json` хранит popup bounds, loaded tiles и видимую атрибуцию. Каталог в браузере — точно сохранённый публичный response, а не придуманные товары.

Для reward UI остановить только свой fixture server на8789. `node --import tsx scripts/tests/ui-fixtures.ts` создаёт отдельные customer/plumber/admin/erase аккаунты и тестовые offers. Запустить app-server с DATABASE_URL равным TEST_DATABASE_URL, AUTH_TOKEN_SECRET=remediation-local-secret-not-production, APP_SERVER_HOST=127.0.0.1, APP_SERVER_PORT=8789, BAZAAR_API_BASE_URL=https://catalog.fixture.invalid, BAZAAR_API_TOKEN=fixture, пустыми TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID/TELEGRAM_WEBHOOK_URL/RAILWAY_PUBLIC_DOMAIN и `--import ./scripts/tests/isolated-network.mjs --import tsx`. Этот preload блокирует любые внешние fetch, кроме собственных fixture адаптеров; реальные SMS не отправляются. Затем `node scripts/tests/reward-ui.mjs`. Сессии только в/private/tmp, в отчёт не включены.

Старые APK/AAB — исторические5b8ea84, не новые binaries. Команды полноценной сборки и58physical сценариев: [NATIVE_OWNER_CHECK](../2026-09-18-remediation/NATIVE_OWNER_CHECK.md). Не выдавать export за установку/обновление/standalone release.
