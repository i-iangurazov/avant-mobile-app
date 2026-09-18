# Полный реестр закрытия

Все17 исходных ID и11 исходных blockers сохранены. D18–D21 перенесены с предыдущего этапа, D22–D23 добавлены здесь. Исходные actual/acceptance не переписаны для улучшения оценки.

|ID|Исходный blocker|Статус|Причина незакрытия|
|---|---|---|---|
|D01|да|FIXED & VERIFIED|Реальный SMS и production incident/legacy-session review отдельно BLOCKED (EX-01/EX-04); исправление уязвимости подтверждено локально.|
|D02|да|FIXED & VERIFIED|Native end-to-end остаётся в исходной physical матрице BLOCKED.|
|D03|да|FIXED & VERIFIED|Проверено на изолированном authoritative inventory fixture. Реальный POS/Bazaar adapter не подключён; production оформление не готово (EX-02).|
|D04|нет|FIXED & VERIFIED|20 параллельных HTTP повторов:1×201+19×200, один ID и одна запись; ни одного5xx.|
|D05|нет|FIXED & VERIFIED|Legacy request_hash=NULL не угадывается: конфликт и проверка истории.|
|D06|да|BLOCKED|Нет утверждённой retention/deletion policy, реальных SMS/media/external-copy проверок и Android/iOS устройства. По исходной приёмке D06 нельзя закрыть только web.|
|D07|да|BLOCKED|Нужны утверждённые тексты, публичные URL, release network inventory и store privacy forms. TEST документ не является действующей policy.|
|D08|да|BLOCKED|Коммерческие правила и юридические условия не утверждены. Pilot settings/benefits не считаются согласованными; публикация/активация до согласования запрещена.|
|D09|да|BLOCKED|Нужно подтверждение владельцем адресов/контактов/часов и native внешнего перехода. Полная исходная приёмка пока не выполнена; источники в MAP_SOURCES.md.|
|D10|да|IMPLEMENTED, NOT VERIFIED|Web acceptance пройден, включая offline/retry. Native release, жесты/переходы на физическом Android/iPhone ещё не проверены. Нет устройств/Xcode; ключ 2GIS больше не является препятствием этой реализации.|
|D11|да|FIXED & VERIFIED|137 реальных операций в тестовом ledger,5 страниц, нет повторов/потерь, сумма сверена с балансом. Production балансы не менялись.|
|D12|да|BLOCKED|Полностью прочитаны2365 уникальных товаров: фото242, описание2, категория2, положительная цена12; все4 поля одновременно0. Не экстраполяция выборки. Общий Bazaar repo найден и изучен; данные не изменялись. Нужны утверждённый release ассортимент и модель цены, staging/org/branch mapping.|
|D13|нет|FIXED & VERIFIED|Метод исходного критерия: расчёт токенов + web screenshots. Полные native large-font/TalkBack/VoiceOver проверки не закрыты.|
|D14|нет|BLOCKED|Нет подключённого реального media storage/decoder и устройства для отказа/ограниченной библиотеки. Local fake adapter не подтверждает provider readiness.|
|D15|нет|FIXED & VERIFIED|Проверены0/1/2/4/5/11/21/1.01 и видимые состояния; исходный метод CODE+WEB.|
|D16|да|IMPLEMENTED, NOT VERIFIED|Итоговый manifest/сборка проверены отдельно; выбор фото/camera denial/каталог на Android release device не выполнены. Не закрывать исходный критерий целиком.|
|D17|нет|IMPLEMENTED, NOT VERIFIED|Два локальных процесса + restart прошли. Исходная приёмка требует staging proxy/replicas; нет доступа. За reverse proxy требуется проверить общий IP bucket/capacity, а не снова доверять заголовку.|
|D18|нет|FIXED & VERIFIED|Physical/staging gates outside the stated local/web method remain in CRITERIA.|
|D19|нет|FIXED & VERIFIED|Physical/staging gates outside the stated local/web method remain in CRITERIA.|
|D20|нет|FIXED & VERIFIED|Physical/staging gates outside the stated local/web method remain in CRITERIA.|
|D21|нет|FIXED & VERIFIED|Physical/staging gates outside the stated local/web method remain in CRITERIA.|
|D22|нет|FIXED & VERIFIED||
|D23|да|FIXED & VERIFIED|Native acceptance остаётся отдельными LOY-20/21/22 PHYSICAL критериями и не засчитан по web.|

## D01 — Самоназначение администратора через непроверенный телефон

**FIXED & VERIFIED**

Исходное поведение: Оба пути дают isAdmin=true и HTTP 200 защищённого admin API без проверки владения номером.

Критерий: Оба сценария возвращают 403; роль не меняется; администратор выдаёт доступ аудируемой операцией; проверить все admin mutation endpoints.

Изменение: Удалено повышение роли по телефону/allowlist. Bound OTP, DB-admin + verified phone, audited grant/revoke, access/refresh rotation и отзыв. Все22 admin method/path защищены.

Компоненты: `scripts/server/auth.ts`, `scripts/server/security.ts`, `scripts/server/admin-roles.ts`, `scripts/app-server.ts`, `src/hooks/useAuth.tsx`

Коммиты: a135f73, f118336, 8f9d7d7, 207877c, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json), [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json)

## D02 — Оформление ведёт на несуществующий заказ; детали существующего пустые

**FIXED & VERIFIED**

Исходное поведение: Заказ сохранён, но переход /orders/local-… даёт 404. Реальный ID показывает 0 товаров, «Покупатель», пустые контакты и выдуманный fallback статуса.

Критерий: Сквозное создание и чтение заказа/резерва сохраняет реальный ID, все поля и timeline; контрактный тест на фактический envelope.

Изменение: Адаптер читает фактический data envelope, сохраняет серверный ID и поля. Убраны fabricated local IDs. Проверена потеря201 ответа, restart/retry, один заказ, очистка корзины, история и повторное открытие.

Компоненты: `src/lib/bazaar/adapters.ts`, `src/lib/api/orders.ts`, `src/lib/orders/checkoutAttempt.ts`, `app/checkout/index.tsx`, `src/hooks/useOrders.ts`

Коммиты: 05eea73, e5d6644

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json), [../2026-09-18-remediation/evidence/screenshots/flow-order-confirmed.png](../2026-09-18-remediation/evidence/screenshots/flow-order-confirmed.png), [../2026-09-18-remediation/evidence/screenshots/flow-order-reopened.png](../2026-09-18-remediation/evidence/screenshots/flow-order-reopened.png)

## D03 — Сервер принимает произвольные цену, количество и филиал заказа

**FIXED & VERIFIED**

Исходное поведение: HTTP 201, итог 9.99, 999 единиц и несуществующий филиал сохранены. В проекте заказы подтверждаются менеджером: списание реальных денег не доказано.

Критерий: Подменённые цена/остаток/филиал отклоняются либо нормализуются сервером; UI показывает пересчёт до подтверждения.

Изменение: Цена/название/остаток/филиал определяются серверными offers/branches в фиксированной организации. Quote до подтверждения, проверка актуальности, транзакционные holds, запрет подмены сумм и дробных/отрицательных количеств.

Компоненты: `scripts/server/order-trust.ts`, `scripts/server/orders.ts`, `scripts/app-server.ts`, `scripts/db/schema.sql`, `src/lib/api/orders.ts`, `app/checkout/index.tsx`

Коммиты: 05eea73, 8f9d7d7, 207877c, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json), [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json), [../2026-09-18-remediation/evidence/screenshots/flow-trusted-quote.png](../2026-09-18-remediation/evidence/screenshots/flow-trusted-quote.png)

## D04 — Параллельный повтор заказа возвращает SQL ошибку 500

**FIXED & VERIFIED**

Исходное поведение: Статусы 201/500/500/500; один заказ сохранён; в JSON раскрыто имя unique constraint. Дубля по одинаковому ключу нет.

Критерий: 20 контролируемых параллельных повторов дают один ID; ни одного 5xx и деталей SQL.

Изменение: Advisory transaction lock account+key сериализует одинаковые запросы; повторное чтение использует занятый DB client, без pool deadlock. Общий5xx ответ не раскрывает SQL.

Компоненты: `scripts/server/orders.ts`, `scripts/app-server.ts`

Коммиты: 8f9d7d7, 207877c, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json)

## D05 — Изменённый заказ под прежним ключом молча принимается

**FIXED & VERIFIED**

Исходное поведение: 200 со старым итогом 9.99; новый payload игнорируется без сообщения.

Критерий: Тот же body → тот же ID; изменённый body → 409, без новой записи.

Изменение: Сохраняется canonical request_hash. Новый payload под прежним ключом даёт409; прежний payload возвращает прежний заказ даже после изменения данных offers.

Компоненты: `scripts/server/orders.ts`, `scripts/db/schema.sql`, `src/lib/orders/checkoutAttempt.ts`

Коммиты: 207877c, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json)

## D06 — Нет пользовательского пути удаления аккаунта

**BLOCKED**

Исходное поведение: В профиле есть только выход; deletion UI/API не найден, DELETE /profile →404. Веб-ресурс удаления владельцем не предоставлен.

Критерий: Удаление тестового аккаунта проходит на Android/iOS и web-странице; вход старым токеном невозможен; сохранённые по обязательствам данные перечислены.

Изменение: Удаление UI/API/web: пароль, bound OTP, текущая версия deletion policy, реальные DELETE/отзыв сессий/media adapter; чужие операции сохраняются. Проверены rollback при ошибке media, остатки, receipts/returns/rewards/audit и web cleanup.

Компоненты: `scripts/server/deletion.ts`, `scripts/app-server.ts`, `app/delete-account.tsx`, `src/hooks/useAuth.tsx`

Коммиты: a135f73, f118336, 8f9d7d7, 207877c, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json), [../2026-09-18-remediation/evidence/screenshots/flow-deletion-confirmation.png](../2026-09-18-remediation/evidence/screenshots/flow-deletion-confirmation.png), [../2026-09-18-remediation/evidence/screenshots/flow-deletion-complete.png](../2026-09-18-remediation/evidence/screenshots/flow-deletion-complete.png)

## D07 — В интерфейсе отсутствует доступная политика приватности

**BLOCKED**

Исходное поведение: Ссылки нет; о приложении показывает поддержку и 2GIS. Наличие текста вне репозитория не установлено.

Критерий: Ссылки доступны без авторизации; содержание соответствует сетевому наблюдению release и анкетам магазинов.

Изменение: Гостевые/profile/registration links и версионный reader privacy/terms/support реализованы. TEST тексты только в изолированной БД; юридические проекты вынесены отдельно.

Компоненты: `app/legal/[kind].tsx`, `src/components/LegalLinks.tsx`, `scripts/server/documents.ts`, `app/profile/about.tsx`

Коммиты: 207877c

Проверки: [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json), [../2026-09-18-remediation/evidence/screenshots/guest-legal-privacy.png](../2026-09-18-remediation/evidence/screenshots/guest-legal-privacy.png)

## D08 — Согласие с правилами лояльности без доступа к самим правилам

**BLOCKED**

Исходное поведение: Checkbox только меняет boolean; нет экрана/ссылки правил. README прямо называет ставки, уровни и условия пилотными.

Критерий: Пользователь читает условия до checkbox; backend хранит версию принятого документа; пилотные значения не обещаны как утверждённые.

Изменение: Ссылки на правила до согласия; сервер требует текущие approved privacy/loyalty versions и сохраняет их вместе с согласием. Ставки/пороги/округление не изменены.

Компоненты: `scripts/server/plumbers.ts`, `scripts/server/documents.ts`, `app/(auth)/register.tsx`, `app/plumber/apply.tsx`

Коммиты: 05eea73, 207877c, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/loyalty-existing.log](../2026-09-18-remediation/evidence/loyalty-existing.log), [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json)

## D09 — Выбранный филиал расходится с карточкой 2GIS

**BLOCKED**

Исходное поведение: В 2GIS адрес Орозбекова 354 и 09:00–20:00; карточка — Безымянная 20/4 и 09:00–18:00. Контакты тоже различаются.

Критерий: Все 6 вариантов, карта и внешний переход ведут к согласованному филиалу; телефон и часы утверждены.

Изменение: Исправлено5 ошибочных firm ID из6. Все6 внешних ссылок используют конкретный firm; адреса сверены по официальным страницам. Неутверждённые одинаковые часы убраны, общий телефон обозначен как поддержка. Подтверждены координаты6 точек; адрес Баткена обновлён согласно текущей публичной карточке.

Компоненты: `src/data/stores.ts`, `src/components/StoreCard.tsx`, `src/components/maps/mapSource.ts`

Коммиты: 05eea73, a2178f3

Проверки: [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json), [../2026-09-18-remediation/evidence/screenshots/guest-maps.png](../2026-09-18-remediation/evidence/screenshots/guest-maps.png), [evidence/branch-coordinates.json](evidence/branch-coordinates.json)

## D10 — Popup карты обрезан; собственные плашки перекрывают виджет

**IMPLEMENTED, NOT VERIFIED**

Исходное поведение: Popup выходит за правый край и обрезан; label и widgetCtaCover конкурируют с содержимым. Юридическое нарушение атрибуции не установлено.

Критерий: На 320/390/430 и native нет обрезки активных данных, атрибуция читается, жесты и fallback работают.

Изменение: Неприспосабливаемый 2GIS iframe заменён Leaflet/OSM с подтверждёнными координатами 6 фирм. Popup ограничен шириной, высота260–390, zoom снизу, атрибуция видна. Сохранены выбор филиала, карточка и внешний переход в 2GIS, timeout/retry.

Компоненты: `src/components/maps/TwoGisMap.tsx`, `src/components/maps/TwoGisMap.web.tsx`, `app/(tabs)/maps/index.tsx`, `src/components/maps/mapSource.ts`, `src/data/branchCoordinates.ts`

Коммиты: 05eea73, a2178f3

Проверки: [evidence/visual.json](evidence/visual.json), [evidence/visual-second-branch.json](evidence/visual-second-branch.json), [evidence/screenshots/map-320.png](evidence/screenshots/map-320.png), [evidence/screenshots/map-390.png](evidence/screenshots/map-390.png), [evidence/screenshots/map-430.png](evidence/screenshots/map-430.png)

## D11 — История лояльности показывает одну операцию вместо полного журнала

**FIXED & VERIFIED**

Исходное поведение: Без limit — 1 запись, с limit=100 —9; UI limit не передаёт и пагинации не содержит.

Критерий: 9 записей видны полностью; набор >100 пролистывается без потерь и повторов; сумма журнала сверяется с балансом.

Изменение: Исправлен default limit1 из Number(null). Cursor pagination timestamp+ID без потери микросекунд, фильтры/сортировка сервера, infinite UI и Показать ещё.

Компоненты: `scripts/app-server.ts`, `scripts/server/loyalty.ts`, `src/lib/api/program.ts`, `src/hooks/useProgram.ts`, `app/plumber/history.tsx`

Коммиты: 05eea73, 8f9d7d7, 207877c, d969620, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json), [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json), [../2026-09-18-remediation/evidence/screenshots/flow-ledger-last-page.png](../2026-09-18-remediation/evidence/screenshots/flow-ledger-last-page.png)

## D12 — Публичный каталог визуально заполнен заглушками

**BLOCKED**

Исходное поведение: В выборке 50/50 без фото, категорий, описания и положительной цены. Популярный блок показывает 2 доступных товара с «Цена уточняется». /categories возвращает404, предусмотрен fallback.

Критерий: Утверждённая выборка ключевых SKU заполнена; пустые поля не занимают большую часть экрана; критерии достаточности ассортимента утверждены.

Изменение: Сокращён пустой image block, исправлен error fallback и contain; global catalog sorting/pagination проверены на137 fixtures. Реальные фото/описания не выдумывались. Исправлены реальные строковые/множественные категории, imageObjects, полный catalog gateway, exact-ID detail и secondary-category filtering.

Компоненты: `src/components/ProductCard.tsx`, `app/product/[id].tsx`, `src/lib/bazaar/completeCatalog.ts`, `src/lib/bazaar/client.ts`, `scripts/server/catalog.ts`, `src/lib/bazaar/adapters.ts`

Коммиты: 05eea73, f118336, 1291e02

Проверки: [../2026-09-18-remediation/evidence/real-api-readonly.json](../2026-09-18-remediation/evidence/real-api-readonly.json), [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json), [evidence/catalog-complete-readonly.json](evidence/catalog-complete-readonly.json), [evidence/gateway-real-source.json](evidence/gateway-real-source.json), [evidence/catalog-gateway.json](evidence/catalog-gateway.json), [evidence/visual.json](evidence/visual.json)

## D13 — Светлый вспомогательный текст имеет низкий контраст

**FIXED & VERIFIED**

Исходное поведение: textSubtle #9CA3AF даёт2.539:1; основной оранжевый #E8380D с белым4.198:1. Это измерение токенов, не утверждение о полном WCAG аудите.

Критерий: Значимый обычный текст ≥4.5:1, крупный ≥3:1; исключения отдельно обоснованы и проверены на устройствах.

Изменение: Увеличен контраст текста primary/muted/subtle/success/warning/danger; проверено12 значимых пар, минимальная из проверенных≥4.5:1.

Компоненты: `src/constants/theme.ts`, `src/components/AppInput.tsx`, `src/components/AppButton.tsx`

Коммиты: a135f73, 05eea73

Проверки: [../2026-09-18-remediation/evidence/contrast.json](../2026-09-18-remediation/evidence/contrast.json), [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json)

## D14 — Пользователю предлагают вставлять HTTPS URL фотографии

**BLOCKED**

Исходное поведение: Поле «HTTPS-ссылка на фото» переносит техническую задачу загрузки на пользователя.

Критерий: Пользователь прикрепляет/удаляет фото без URL; проверены размер, отказ разрешений и ошибка загрузки.

Изменение: URL inputs заменены системным picker/upload/preview/removal из формы. API проверяет размер/type и ownership. Defined media adapter требует decode/re-encode/EXIF cleanup и delete.

Компоненты: `src/components/PhotoAttachment.tsx`, `scripts/server/media.ts`, `scripts/app-server.ts`, `app/plumber/apply.tsx`, `app/find-plumber/index.tsx`

Коммиты: 05eea73, 8f9d7d7, 207877c, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json)

## D15 — Русская локализация содержит технический текст и неправильные формы

**FIXED & VERIFIED**

Исходное поведение: «1 бонусов», «3 бонусов», «4 бонусов»; admin показывает pending/sent и буквальные \n.

Критерий: Проверены0/1/2/4/5/11/21/1.01, все статусы переведены, нет литерального \n.

Изменение: Склонение бонусов целыми minor units, товаров/позиций и стажа; переводы notification/reward/profile статусов, реальный newline вместо literal\n.

Компоненты: `src/lib/programFormat.ts`, `src/lib/formatters.ts`, `src/components/OrderCard.tsx`, `src/components/CategoryCard.tsx`, `app/orders/[id].tsx`, `app/(tabs)/catalog/index.tsx`, `app/admin/index.tsx`, `app/(tabs)/profile/index.tsx`

Коммиты: 5b8ea84, 05eea73, f118336, 207877c

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log), [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json), [../2026-09-18-remediation/evidence/screenshots/plumber-plumber-history.png](../2026-09-18-remediation/evidence/screenshots/plumber-plumber-history.png)

## D16 — Для единичного выбора фото запрошен READ_MEDIA_IMAGES

**IMPLEMENTED, NOT VERIFIED**

Исходное поведение: READ_MEDIA_IMAGES явно объявлен; prebuild также содержит WRITE_SETTINGS, SYSTEM_ALERT_WINDOW и legacy storage — их финальное слияние ещё не проверено.

Критерий: Итоговый AAB не содержит необоснованных разрешений; фото выбирается без широкого доступа; отказ не блокирует каталог.

Изменение: Одиночный системный picker без broad library request. Blocked media/storage/settings/overlay/audio; после анализа merged manifest также исключены unused biometric/vibration.

Компоненты: `app.json`, `app/image-search/index.tsx`, `src/components/PhotoAttachment.tsx`

Коммиты: ce3107f, 1640709, 05eea73, 207877c

Проверки: [../2026-09-18-remediation/evidence/android-aab-manifest.xml](../2026-09-18-remediation/evidence/android-aab-manifest.xml), [../2026-09-18-remediation/evidence/android-permissions.txt](../2026-09-18-remediation/evidence/android-permissions.txt), [../2026-09-18-remediation/evidence/android-artifacts.json](../2026-09-18-remediation/evidence/android-artifacts.json)

## D17 — Локальный rate limit обходится X-Forwarded-For

**IMPLEMENTED, NOT VERIFIED**

Исходное поведение: После429 подмена заголовка даёт401 и обработку запроса. Поведение Railway proxy не проверялось.

Критерий: В staging spoof header не сбрасывает лимит; рестарт/несколько replicas сохраняют ограничения.

Изменение: Доверенный идентификатор — socket peer; произвольный X-Forwarded-For игнорируется. Атомарный общий DB rate limit переживает process restart и replicas.

Компоненты: `scripts/server/security.ts`, `scripts/app-server.ts`, `scripts/db/schema.sql`

Коммиты: 8f9d7d7, 207877c, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json), [../2026-09-18-remediation/evidence/replica-rate-limit.json](../2026-09-18-remediation/evidence/replica-rate-limit.json)

## D18 — Другой rewardId под прежним ключом незаметно возвращал старую награду

**FIXED & VERIFIED**

Исходное поведение: Same clientRequestId, different rewardId returned the first redemption.

Критерий: Другой rewardId →409;20 одинаковых повторов →один ID/одно списание.

Изменение: Добавлена проверка reward_id до idempotent replay.

Компоненты: `scripts/server/loyalty.ts`

Коммиты: d969620

Проверки: [../2026-09-18-remediation/evidence/D18-before.json](../2026-09-18-remediation/evidence/D18-before.json), [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log)

## D19 — Состояния выбора не попадали в web accessibility API

**FIXED & VERIFIED**

Исходное поведение: При первом прогоне новый selector визуально закрывался, но aria-expanded отсутствовал; accessibilityState не переносится react-native-web0.21. Исходные radio/checkbox использовали тот же механизм.

Критерий: Открытие/закрытие и checked состояния доступны в DOM; Escape сохраняет выбор.

Изменение: Явные aria-expanded/checked/selected/busy/disabled; корректные radio semantics, подписи inputs.

Компоненты: `src/components/SelectField.tsx`, `src/components/AppInput.tsx`, `src/components/AppButton.tsx`, `app/checkout/index.tsx`

Коммиты: 05eea73, e5d6644

Проверки: [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json), [../2026-09-18-remediation/evidence/screenshots/flow-select-search.png](../2026-09-18-remediation/evidence/screenshots/flow-select-search.png)

## D20 — Параллельные изменения локальной корзины теряли количество

**FIXED & VERIFIED**

Исходное поведение: Реальный модуль baseline c88450a:20 одновременных add дают quantity1 вместо20.

Критерий: 20 add сохраняются; consume+add+replay вычитает отправленное один раз; clear ждёт предыдущие мутации.

Изменение: Хранилище сериализует read-modify-write, cart/applied key сохраняются одним значением.

Компоненты: `src/lib/cart/cartStore.ts`, `src/lib/cart/localCart.ts`, `src/hooks/useAuth.tsx`

Коммиты: f118336, e5d6644, ae18b5e

Проверки: [../2026-09-18-remediation/evidence/D20-before.json](../2026-09-18-remediation/evidence/D20-before.json), [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log)

## D21 — Отсутствующая API-конфигурация молча выбирала production

**FIXED & VERIFIED**

Исходное поведение: Baseline env module без EXPO_PUBLIC_API_URL возвращал production Railway URL. Ошибка имени переменной не останавливала подключение.

Критерий: Без config URL пустой; production build gate отклоняет missing/http/test/debug config; embedded native URL проверен.

Изменение: Удалён implicit production fallback; добавлен EAS pre-install/ручной validator и явные build endpoints.

Компоненты: `src/lib/config/env.ts`, `scripts/build/verify-env.cjs`, `package.json`

Коммиты: 1640709

Проверки: [../2026-09-18-remediation/evidence/release-env.json](../2026-09-18-remediation/evidence/release-env.json), [../2026-09-18-remediation/evidence/android-artifacts.json](../2026-09-18-remediation/evidence/android-artifacts.json)

## D22 — Недоступный товар ошибочно считался доступным

**FIXED & VERIFIED**

Исходное поведение: В исходном6c40f51 оба случая возвращали inStock=true.

Критерий: Оба исходных и соседние negative-status сценарии возвращают false; положительные случаи каталога не ломаются.

Изменение: Точное сравнение статусов; отрицательные сигналы проверяются первыми.

Компоненты: `src/lib/bazaar/adapters.ts`, `scripts/tests/catalog-gateway.ts`

Коммиты: 1291e02

Проверки: [evidence/D22-before.json](evidence/D22-before.json), [evidence/catalog-gateway.json](evidence/catalog-gateway.json), [evidence/regression-suite.log](evidence/regression-suite.log)

## D23 — Повтор обмена после потери ответа создавал новое списание бонусов

**FIXED & VERIFIED**

Исходное поведение: Старый экран генерировал новый ключ на каждое подтверждение; воспроизведены2 заявки.

Критерий: ПотеряACK/перезапуск/20параллельныхповторов:однаDBзаявка/ledger; подтверждённая квитанция сохраняется до явного действия; другой аккаунт её не видит; отсутствие награды после первого списания не блокирует восстановление.

Изменение: Сохранённая account-scoped попытка, single-flight, повтор исходного ключа, серверный no-operation отказ, квитанция до явного подтверждения и очистка при удалении аккаунта. Ключ сохраняется при обычном выходе, чтобы возврат в тот же аккаунт не создал повтор; токен/телефон не хранятся в попытке.

Компоненты: `src/lib/rewards/rewardAttempt.ts`, `src/hooks/useProgram.ts`, `app/plumber/rewards.tsx`, `app/delete-account.tsx`, `scripts/server/loyalty.ts`, `scripts/tests/reward-attempt.ts`, `scripts/tests/reward-ui.mjs`

Коммиты: 615510d, 9a7b421

Проверки: [evidence/reward-retry.json](evidence/reward-retry.json), [evidence/reward-ui.json](evidence/reward-ui.json), [evidence/screenshots/reward-lost-ack.png](evidence/screenshots/reward-lost-ack.png), [evidence/screenshots/reward-recovered.png](evidence/screenshots/reward-recovered.png)