# Повторные проверки

Изолированная ветка, финальный продуктовый source **5b8ea84**. PostgreSQL16, отдельная БД `remediation` на127.0.0.1:55448, Node22.18.0. Тестовые роли/номера, catalog snapshot, SMS/Telegram transport и media adapter изолированы. Изменений production данных, SMS пользователям, реальных списаний, выкладок и загрузок в магазины не было.

|Проверка|Фактический результат|Доказательство|
|---|---|---|
|Новая regression suite|135 записанных проверок: security40, orders28, ledger14, deletion25, media6, catalog/cart/localization22; PASS|[Лог](evidence/regression-suite.log)|
|HTTP API|74 проверки,22 admin method/path; guest401/customer403, параллельные20 заказов —1×201+19×200 с одним ID; PASS|[JSON](evidence/http-security.json)|
|Web flow Chrome390×844|25 проверок; потерянный после commit ответ → reload → retry → один SQL order/hold, реальный detail/history/cart;137 операций/5 страниц, session/delete; PASS|[JSON](evidence/ui-flows.json), [лог](evidence/ui-flows.log)|
|Исходные suites|`check:orders` и `check:loyalty` PASS на локальной БД|[orders](evidence/orders-existing.log), [loyalty](evidence/loyalty-existing.log)|
|DB recovery|pg_dump consistent snapshot → restore в отдельную временную БД; counts всех34 таблиц совпали; additive migration baseline→new дважды без выдачи admin|[JSON](evidence/database-recovery.json)|
|Лимит запросов|Общий счётчик сохранился при втором локальном HTTP process и restart, spoofed XFF не обошёл429; staging proxy не проверен|[JSON](evidence/replica-rate-limit.json)|
|Release config|Baseline реально выбирал production fallback без env; новый клиент не делает запрос;6 env cases PASS|[JSON](evidence/release-env.json)|
|Типы/lint|Оба PASS после финальных продуктовых изменений|[typecheck](evidence/typecheck.log), [lint](evidence/lint.log)|
|Зависимости|npm audit0; expo dependency check PASS; doctor17/18, оставшийся fail — CocoaPods/toolchain|[audit](evidence/npm-audit-after.json), [doctor](evidence/expo-doctor.log)|
|Export|Web + Android Hermes + iOS Hermes PASS; это не native установка|[Лог](evidence/expo-export-final.log)|
|Контраст|12 значимых цветовых пар≥4.5:1; native font rendering не измерен|[JSON](evidence/contrast.json)|
|Клиентские bundles|3 фактических bundles: server-secret markers/fixture password не найдены; ограниченный scan|[JSON](evidence/bundle-scan.json)|
|Реальный публичный API|Только3 GET: health/products/categories; deployed SHA неизвестен. В50 SKU sample по-прежнему отсутствуют полноценные фото/описания/цены/категории|[JSON](evidence/real-api-readonly.json)|

Новая suite запускается: `TEST_DATABASE_URL=postgresql://audit@127.0.0.1:55448/remediation npm run check:remediation`. Серверная HTTP suite и браузерные helper scripts отказываются работать с иной БД либо используют фиксированные loopback URL. Сначала поднять disposable PostgreSQL на55448, создать пользователя `audit` и БД `remediation` (не направлять тесты на production), затем установить зависимости через `nvm use && npm ci`.

Для локального API используются `DATABASE_URL` с этой БД, `APP_SERVER_HOST=127.0.0.1`, `APP_SERVER_PORT=8789`, `NODE_ENV=test`, `APP_ORGANIZATION_ID=fixture-org`, `DELIVERY_BRANCH_ID=store-1`, `AUTH_TOKEN_SECRET=remediation-local-secret-not-production`, fixture SMS/catalog URLs и preload `node --import ./scripts/tests/isolated-network.mjs --import tsx scripts/app-server.ts`. Preload заменяет **все** внешние fetch: SMS/Telegram/catalog подставляются только для тестовых hosts; остальные запрещены. `SMS_PROVIDER_URL=https://sms.fixture.invalid`, `SMS_PROVIDER_TOKEN=fixture`, `BAZAAR_API_BASE_URL=https://catalog.fixture.invalid`, `BAZAAR_API_TOKEN=fixture`, `TELEGRAM_BOT_TOKEN=fixture:token`, `TELEGRAM_CHAT_ID=fixture`, `TELEGRAM_WEBHOOK_URL=`. `ACCOUNT_DELETION_MODE=erase-all` разрешён только с тестовыми документами в этой изолированной БД. Реальные секреты/URLs сюда не подставлять. Конкретный trusted org/store context создаёт `scripts/tests/ui-fixtures.ts`.

Web: экспорт `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:8789 npx expo export --platform all --output-dir /private/tmp/avantehnik-remediation-export`; запустить `node scripts/tests/static-export.mjs`, затем `TEST_DATABASE_URL=... npx tsx scripts/tests/ui-fixtures.ts`, `TEST_DATABASE_URL=... node scripts/tests/ui-flows.mjs`. После flow customer revoked и erase удалён намеренно: перед повторным flow создать fixtures заново, перед gallery выполнить `refresh-fixtures.ts`. Gallery/extra-gallery использует localhost8090, локальный Chrome и временный профиль. Это тестовые helper scripts, не production сервисы. CI workflow добавлен, remote CI не запускался.

Утверждённые бизнес-правила не придумывались: существующая логика ставок/rounding/pending/levels сохранена и проверена как поведение кода. Это не коммерческое согласование. Возврат до чека отвечает404; повтор после доставки чека согласуется и не дублирует журнал. Требуется согласовать retry POS (Q02). Полный/частичный возврат, повтор,20 параллельных reward запросов и возврат одновременно со списанием проверены; production баланс не пересчитывался.

## Сборки и ограничения

Standalone Android APK/AAB, arm64-v8a, release variant: [финальный build](evidence/android-release-minimal.log), [hash/ELF/signing scope](evidence/android-artifacts.json). Target36/min24,17 ELF≥16KB, zipalign-P16 и AAB PAGE_ALIGNMENT_16K. Тестовый Android Debug сертификат, API `https://staging.avantehnik.invalid` намеренно не работает. Файлы нельзя отправлять в магазин; требуется пересборка с approved staging и upload signing. APK не устанавливался: [adb devices](evidence/android-devices.log). Никакой runtime/16KB/physical результат не выведен из статического manifest.

iOS prebuild и Hermes export PASS; Xcode/Pods недоступны, IPA/xcarchive не получены: [toolchain](evidence/ios-toolchain.log). Signing, fresh install, upgrade, offline/retry/background, gestures/keyboard/safe area, TalkBack/VoiceOver, увеличенный шрифт, performance/crash и реальные push/SMS/camera/gallery/maps обеих платформ остаются BLOCKED. Точные команды и сценарий: [NATIVE_OWNER_CHECK](NATIVE_OWNER_CHECK.md).

Сохранены промежуточные неуспешные попытки: первый Android C++ build исчерпал диск, wrapper download поймал timeout, Metro после обновления image-size потребовал совместимый Buffer call, ранний UI harness не прокручивал виртуализованный список целиком. Они не выдаются за PASS: финальные evidence выше относятся к исправленной реализации/проверке. `ui-flows-failed.json` — промежуточный запуск; итоговый `ui-flows.json` содержит полный PASS. Найденный отдельно отсутствующий aria state исправлен как D19; исходный DOM снимок этого раннего сбоя не сохранён, финальный runtime state проверен.
