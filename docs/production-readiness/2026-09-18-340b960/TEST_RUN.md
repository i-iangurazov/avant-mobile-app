# Прогон и воспроизведение

Продуктовый код не менялся:194файла совпали с baseline manifest. Отдельные исходники копировались в `/private/tmp/avantehnik-audit-20260918`, зависимости подключены symlink на уже установленный node_modules. `.env` **не копировался**. Prebuild изменял package.json и создавал native dirs только в этой копии. Полный pipeline затрагивал исключительно временный кластер PostgreSQL, fixture аккаунты и локальный браузерный профиль.

## Выполнено

|Проверка|Команда/средство|Результат|
|---|---|---|
|Типы|npm run typecheck|exit0, клиент+сервер|
|Lint|npm run lint|exit0|
|Заказы|DATABASE_URL=локальная audit DB npm run check:orders|PASS; Telegram подменён самим тестом|
|Лояльность|DATABASE_URL=локальная audit DB npm run check:loyalty|PASS; собственная29assertions summary; не полный E2E|
|JS/assets|expo export --platform all --output-dir /private/tmp/avantehnik-audit-export|PASS web1.61MB, Android4.06MB Hermes, iOS4.07MB Hermes; размеры из CLI, не installed/download size|
|Native generation|expo prebuild --no-install в копии|PASS; warning expo-system-ui|
|Android release|GRADLE_USER_HOME=/private/tmp/audit-gradle ./gradlew :app:bundleRelease --offline|BLOCKED: Java Runtime отсутствует|
|iOS archive|xcodebuild -project ios/Avantehnik.xcodeproj -scheme Avantehnik -configuration Release -archivePath /private/tmp/audit-Avantehnik.xcarchive archive|BLOCKED: Xcode отсутствует|
|API negatives|evidence/tools/audit-api.mjs|D01,D03,D04,D05,D17;14результатов вJSON|
|Дополнительные бонусы|evidence/tools/audit-loyalty-extra.ts|16результатов/вопросов вJSON, независимые ожидаемые суммы|
|История|GET transactions с/без limit|1 против9;4 возвратных строки с явнымlimit|
|UI|audit-gallery.mjs + audit-extra-ui.mjs, Chrome CDP|75PNG/58состояний,0Runtime.exceptionThrown в итоговых58записях; это не crash-free native metric|
|Зависимости|npm audit --json|12затронутых пакетов;3unique advisories; не автоматический exploit verdict|
|Production read-only|GET health/categories/products|200/404/200, без авторизации/изменений; catalog snapshot сохранён|

## Изоляция для повторного запуска

Использовать новую копию текущего snapshot и **новую пустую локальную БД**. В существующих test scripts встречается ensureSchema и запись конфигурации: рабочую/production БД не подставлять. Порт кластера в проведённом прогоне55448, пользовательaudit, базаaudit. API8788, static export8089, dev Metro8088. Staging секреты для этих тестов не нужны.

1. Сверить source-manifest.json с исходниками. Скопировать исходники без.env/.git; использовать npm ci в изоляции, если установленного node_modules нет. Версии из lockfile; скачивание зависимостей — отдельная операция окружения.
2. Создать отдельный PostgreSQL16 cluster и пустуюaudit DB. Выполнить check:orders, затем check:loyalty последовательно: оба используют локальные тестовые записи.
3. Скопировать `evidence/catalog-snapshot.json` в `/private/tmp/audit-real-products.json`. Скрипт `audit-net.mjs` возвращает этот snapshot вместо upstream catalog; Telegram ответы полностью подменены. Любой другой backend fetch выбрасывает ошибку. Это MOCK, не REAL integration.
4. Запустить копию API через `node --import ./audit-net.mjs --import tsx scripts/app-server.ts` с локальным DATABASE_URL, APP_SERVER_HOST=127.0.0.1, APP_SERVER_PORT=8788, тестовым AUTH_TOKEN_SECRET, ADMIN_PHONE_NUMBERS=+996700000091,+996700000092, BAZAAR_API_BASE_URL=https://audit-catalog.invalid, BAZAAR_API_TOKEN=audit-placeholder, TELEGRAM_BOT_TOKEN=audit-placeholder, TELEGRAM_CHAT_ID=audit-only. Не задавать реальный webhook URL. Файл.env в копии отсутствует.
5. `audit-api.mjs` создаёт4fixture роли, локальные заказы и `/private/tmp/audit-sessions.json`; файл содержит только временные тестовые токены и намеренно не включён в отчёт. При повторе нужна чистая БД из-за фиксированных телефонов/ID.
6. `audit-loyalty-extra.ts` запускается через `node --import tsx` из корня копии; использует ту же тестовую сессию, создаёт receipt/return/reward fixtures. Он не предназначен для production.
7. Экспортировать web c EXPO_NO_DOTENV=1 и EXPO_PUBLIC_API_URL=http://127.0.0.1:8788. Раздавать export с SPA fallback и **decodeURIComponent URL path**, корректнымfont MIME. Иначе пробелы в symlink paths сломают TTF средствами раздачи, а не кодом приложения. Original Metro smoke однажды дал пустой экран; итоговая галерея использует работоспособный static export.
8. Запускать CDP harness с отдельным Chrome user-data-dir. Скрипты содержат абсолютный каталог вывода текущего аудита — при повторе заменить его на новый audit folder, не перетирать baseline. Сценарии и ограничения фактического клика описаны в gallery-index.json. Нажатие на label, которого нет, не выдаётся за успешный action.
9. По завершении остановить созданные API/static/Metro/Postgres. Отправки Telegram/review/publication в этом pipeline нет. Для реального staging transport потребуется отдельный согласованный тестовый контур.

## Обращение с доказательствами

RAW production HTML категории404 не включён: достаточно статуса/content type/размера. Catalog snapshot содержит публичные товары/магазин, не заказы/аккаунты. API proof JSON не содержит bearer tokens/passwords. Скриншоты имеют вымышленные Audit accounts; бизнес-контакты2GIS/магазинов оставлены как необходимое свидетельство несовпадения. Неопубликованные реальные телефоны/секреты из.env не копировались в отчёт.

Временные API/static/Metro и отдельный PostgreSQL остановлены: [cleanup.json](evidence/cleanup.json). Разрешённый запуск Metro работал; первоначальная попытка в sandbox завершилась ERR_SOCKET_BAD_PORT при поиске доступного порта — ограничение окружения, не доказанный product defect. Runtime Node в оболочке и диагностике первого CLI различался; будущий CI должен фиксировать версию. Установленный Expo54.0.37, диапазон package.json~54.0.35.
