# Railway: конкретный пакет внедрения, 21.09.2026

Пакет внедрён после явного разрешения владельца. API и admin-web опубликованы,3аккаунта перенесены, владелец получил роль администратора. Проект `14a5ce7e-4f57-4135-b1d0-5989f1d7b72b`, environment `production` / `ebc3e5a9-a536-46ca-bc3d-dd6d46d45f15`, API service `9cddd321-f782-4123-b7fc-e622f53389ac`. Рабочий адрес: https://api-production-2e6d.up.railway.app. Сейчас он запускает новый app-server из `fa7e957` через `npm run start:server`; каталог читается из базы сайта.

## Preflight до внедрения

Локальная `.env` действительно указывает на ту же БД, что сайт. До внедрения Railway API использовал другую БД: только `app_customers`, 3 записи. До внедрения в БД сайта мобильные `app_customers/app_orders/app_order_items/app_order_status_events` пусты, каталог Product/Variant существует. Полный каталог содержит 889/2233 строк, опубликованный и доступный витрине — 845 товаров/2147 вариантов. Эти два числа описывают разные фильтры, а не потерю товаров.

Конфликтов переноса аккаунтов не найдено. ID, password_hash, timestamps и телефоны сохраняются; скрипт не печатает персональные данные. Номер владельца получен отдельно; такого аккаунта в обеих БД нет. Private secrets/backups/credentials исключены из Git.

Доказательства: [базы](evidence/database-compare-redacted.json), [Railway](evidence/railway-preflight-redacted.json), [перенос dry-run](evidence/account-copy-preflight.json), [регрессии миграции/bootstrap](evidence/deployment-regressions.json), [режим заявок](evidence/inquiry-orders.json).

## Подготовленные изменения

- Полная additive миграция `scripts/db/migrations/20260921-complete-app-schema.sql` создаёт недостающую схему. Прежние две миграции сами по себе недостаточны для текущей production БД. Новая миграция не добавляет администраторов, правила лояльности, остатки, документы или транзакции бонусов. Таблицы сайта не меняет. Проверены первый и повторный запуск на legacy структуре.
- `scripts/db/copy-legacy-accounts.ts`: по умолчанию read-only dry-run; запись требует `--apply` и контрольную сумму проверенных исходных записей. Конфликт ID/телефона или расширение исходной схемы прерывает перенос. Старые записи не удаляются.
- `scripts/admin/bootstrap-owner.ts`: отдельная операторская команда создаёт только нового первого администратора с случайным паролем, записью аудита и private credential file0600. Существующий номер не захватывает; параллельные запуски дают ровно одного администратора. В публичной регистрации повышение по телефону отсутствует.
- Владелец явно согласовал 21.09 режим заявок: наличие и доставка уточняются через WhatsApp. `ORDER_FULFILMENT_MODE=inquiry` работает только с каталогом сайта. Сервер проверяет активный вариант, свежую цену, количество и разрешённый филиал. Не создаются фиктивные остатки/резервы. В режиме `inventory` прежние проверки остатков сохраняются.
- `Dockerfile.admin`, `railway.admin.json`, `scripts/admin-web.mjs`: отдельный веб-сервис со SPA-путями `/login`, `/admin`, `/admin/orders`, `/admin/recovery`, `/delete-account`. API остаётся отдельным сервисом, поэтому одинаковые пути `/admin/orders` не конфликтуют. Проверены deep links, отсутствие выдачи `.env`, missing assets, escape через symlink и отказ POST на static server.

## Согласованный порядок и фактическое выполнение

1. Проверить актуальность приватных backups обеих БД и восстановление в изолированную БД. На время cutover остановить регистрации на старом API; старую БД оставить для отката. Повторить dry-run после остановки записи. Не публиковать credentials или дампы в Git/логи.
2. Отключить автоматическое развёртывание linked `main` на время подготовки. **Push main может запустить Railway автоматически**, до миграции этого делать нельзя. Сохранить текущие Railway variables/deployment ID и webhook configuration privately.
3. Применить полную миграцию к целевой БД сайта, затем перенести аккаунты. Только явные переменные нужной среды; команды не читают `.env` автоматически:

```sh
PGDATABASE="$TARGET_DATABASE_URL" psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/migrations/20260921-complete-app-schema.sql
SOURCE_DATABASE_URL="$OLD_RAILWAY_DATABASE_URL" TARGET_DATABASE_URL="$TARGET_DATABASE_URL" node --import tsx scripts/db/copy-legacy-accounts.ts
# Вставить digest свежего dry-run; не использовать старый digest после изменения данных.
SOURCE_DATABASE_URL="$OLD_RAILWAY_DATABASE_URL" TARGET_DATABASE_URL="$TARGET_DATABASE_URL" node --import tsx scripts/db/copy-legacy-accounts.ts --apply "$REVIEWED_DIGEST"
```

Передать секреты защищённым окружением; не сохранять shell history с literal URL/паролями. Сверить 3 перенесённых аккаунта по ID/hash/timestamps. Не переносить Session/User сайта в мобильную авторизацию.

4. Проверить [BRANCHES_FOR_REVIEW.json](BRANCHES_FOR_REVIEW.json). Это текущие 6 филиалов приложения, а не новое подтверждение владельцем. Особое внимание адресу store-3 и филиалу обработки доставки store-1. После подтверждения:

```sh
DATABASE_URL="$TARGET_DATABASE_URL" APP_ORGANIZATION_ID=avantehnik node --import tsx scripts/db/configure-inquiry-branches.ts docs/production-readiness/2026-09-21-device-verification/BRANCHES_FOR_REVIEW.json --apply
DATABASE_URL="$TARGET_DATABASE_URL" node --import tsx scripts/admin/bootstrap-owner.ts "$OWNER_PHONE" 'Владелец Авантехник' "$EXPECTED_DATABASE_NAME" 'Owner-authorized production bootstrap 2026-09-21' .release-secrets/production-owner.json
```

Команда bootstrap не запускается автоматически при деплое. При ошибке COMMIT сохранить private credential file и проверить account ID до повторной попытки.

5. Railway API: `DATABASE_URL` = целевая БД сайта; `PRODUCT_CATALOG_SOURCE=database`, `ORDER_FULFILMENT_MODE=inquiry`, `APP_ORGANIZATION_ID=avantehnik`, `DELIVERY_BRANCH_ID=store-1`, `NODE_ENV=production`. Сохранить сильный `AUTH_TOKEN_SECRET`; настроить существующие server-only `TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID`, webhook secret и `TELEGRAM_WEBHOOK_URL=https://api-production-2e6d.up.railway.app/telegram/webhook`. Удалить `BAZAAR_API_BASE_URL`, `BAZAAR_API_TOKEN`, `BAZAAR_PROXY_HOST` после сохранения private rollback config. Start command — `npm run start:server`. Секреты не должны попасть в `EXPO_PUBLIC_*`.
6. Сверить очередь и журнал перед запуском: в обеих исходных БД заказов/ledger нет; после миграции новые очереди должны быть пусты. Startup регистрирует Telegram webhook и запускает workers — это реальное изменение внешнего сервиса. Старые нерассмотренные операции автоматически не импортировать. Не добавлять неутверждённые loyalty rules/documents и не проводить бонусные списания.
7. Push reviewed main, deploy API; проверить health, первые15 товаров/изображения/цены, вход перенесённого тестового аккаунта при наличии разрешения его владельца, запрет admin для customer. Создать отдельный обозначенный тестовый заказ без оплаты, получить одно уведомление и пройти смену статуса кнопкой в согласованной группе. Не считать mock-тест доказательством рабочей доставки.
8. Создать отдельный Railway service `admin-web`, repo тот же, `EXPO_PUBLIC_API_URL` = HTTPS API на этапе сборки. Сгенерировать Railway HTTPS domain, затем проверить login/deep links/admin403 для клиента. Передать владельцу реальный `/admin` URL и private credentials по отдельному защищённому пути. Сервис опубликован: https://admin-web-production-4bbc.up.railway.app/admin. Railway отказал в назначении нового config-as-code path (deprecated API), поэтому фактически использован отдельный upload context с `Dockerfile.admin` под именем `Dockerfile`, `scripts/admin-web.mjs` и клиентским исходным кодом; корневой `railway.json` API исключён. Start command: `node scripts/admin-web.mjs`; build переменные API URL и business WhatsApp переданы Docker ARG. Не запускать admin upload из корня с API railway.json.
9. Android: собрать `kg.avantehnik.app` с production HTTPS API и созданным upload key; проверить через Google Play internal track. Тестовый `kg.avantehnik.acceptance` с loopback API в Google Play не загружать. Документы, deletion/retention, Data safety, review credentials и оставшиеся native gates сохраняют NO-GO до выполнения.

## Откат

При ошибке сохранить исходную БД Railway и новую БД, остановить новые записи/очереди, зафиксировать незавершённые заказы. Additive таблицы не удалять, ни одну общую таблицу сайта не откатывать целиком поверх новых записей. Не включать прежнюю уязвимую выдачу admin по номеру. Исправить конфигурацию/код в maintenance; если требуется обратный перенос уже созданных заказов, это отдельный сверенный план. Webhook возвращать только проверенному обработчику, без `drop_pending_updates`. После восстановления сверить все order IDs, уведомления, статусы и аккаунты.

Первоначальный запрос запрещал production deployment;21.09владелец явно разрешил этот пакет ответом «Да, выполняй внедрение». Разрешение получено, пакет внедрён; тестовая заявка и отправка в Telegram также отдельно разрешены владельцем. Выпуск в Google Play остаётся отдельным этапом.

## Результат

API deployment `3caef0b4-db70-4fae-b6b3-700c3d612766`, admin-web `41e0802e-cfaa-4422-8c78-30d620d7d158`. GitHub automatic deployment временно отключён при cutover; текущие сервисы опубликованы CLI, последующий push сам по себе не выкатывает сервер. Старый PostgreSQL сохранён. Backup обеих БД восстановлен в disposable локальные БД до удаления тестовых копий. Секреты/backups остаются private.

[Миграция](evidence/production-migration.json), [backup/restore](evidence/backup-restore-rehearsal.json), [реальный заказ/Telegram](evidence/production-live-check.json), [production Android](evidence/native-production-release.json).
