# Реестр закрытия

Исходные17 IDs и11 release_blocker flags сохранены. FIXED & VERIFIED применяется только при выполненной исходной приёмке указанным методом; native/staging требования не заменены web.7 исходных release blockers остаются незакрытыми.

|ID|Приоритет|Исходный release blocker|Статус|
|---|---|---|---|
|D01|P0|да|FIXED & VERIFIED|
|D02|P1|да|FIXED & VERIFIED|
|D03|P1|да|FIXED & VERIFIED|
|D04|P2|нет|FIXED & VERIFIED|
|D05|P2|нет|FIXED & VERIFIED|
|D06|P1|да|BLOCKED|
|D07|P1|да|BLOCKED|
|D08|P1|да|BLOCKED|
|D09|P1|да|BLOCKED|
|D10|P2|да|BLOCKED|
|D11|P1|да|FIXED & VERIFIED|
|D12|P2|да|BLOCKED|
|D13|P2|нет|FIXED & VERIFIED|
|D14|P2|нет|BLOCKED|
|D15|P3|нет|FIXED & VERIFIED|
|D16|P1|да|IMPLEMENTED, NOT VERIFIED|
|D17|P2|нет|IMPLEMENTED, NOT VERIFIED|
|D18|P2|нет|FIXED & VERIFIED|
|D19|P2|нет|FIXED & VERIFIED|
|D20|P2|нет|FIXED & VERIFIED|
|D21|P2|нет|FIXED & VERIFIED|

## D01 — Самоназначение администратора через непроверенный телефон

**FIXED & VERIFIED**. Исходное поведение: Оба пути дают isAdmin=true и HTTP 200 защищённого admin API без проверки владения номером.

Приёмка: Оба сценария возвращают 403; роль не меняется; администратор выдаёт доступ аудируемой операцией; проверить все admin mutation endpoints.

Изменение: Удалено повышение роли по телефону/allowlist. Bound OTP, DB-admin + verified phone, audited grant/revoke, access/refresh rotation и отзыв. Все22 admin method/path защищены.

Компоненты: `scripts/server/auth.ts`, `scripts/server/security.ts`, `scripts/server/admin-roles.ts`, `scripts/app-server.ts`, `src/hooks/useAuth.tsx`.

Commits: a135f73, f118336, 8f9d7d7, 207877c, e5d6644, ae18b5e.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/http-security.json](evidence/http-security.json), [evidence/ui-flows.json](evidence/ui-flows.json).

Граница результата / препятствие: Реальный SMS и production incident/legacy-session review отдельно BLOCKED (EX-01/EX-04); исправление уязвимости подтверждено локально.

## D02 — Оформление ведёт на несуществующий заказ; детали существующего пустые

**FIXED & VERIFIED**. Исходное поведение: Заказ сохранён, но переход /orders/local-… даёт 404. Реальный ID показывает 0 товаров, «Покупатель», пустые контакты и выдуманный fallback статуса.

Приёмка: Сквозное создание и чтение заказа/резерва сохраняет реальный ID, все поля и timeline; контрактный тест на фактический envelope.

Изменение: Адаптер читает фактический data envelope, сохраняет серверный ID и поля. Убраны fabricated local IDs. Проверена потеря201 ответа, restart/retry, один заказ, очистка корзины, история и повторное открытие.

Компоненты: `src/lib/bazaar/adapters.ts`, `src/lib/api/orders.ts`, `src/lib/orders/checkoutAttempt.ts`, `app/checkout/index.tsx`, `src/hooks/useOrders.ts`.

Commits: 05eea73, e5d6644.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/ui-flows.json](evidence/ui-flows.json), [evidence/screenshots/flow-order-confirmed.png](evidence/screenshots/flow-order-confirmed.png), [evidence/screenshots/flow-order-reopened.png](evidence/screenshots/flow-order-reopened.png).

Граница результата / препятствие: Native end-to-end остаётся в исходной physical матрице BLOCKED.

## D03 — Сервер принимает произвольные цену, количество и филиал заказа

**FIXED & VERIFIED**. Исходное поведение: HTTP 201, итог 9.99, 999 единиц и несуществующий филиал сохранены. В проекте заказы подтверждаются менеджером: списание реальных денег не доказано.

Приёмка: Подменённые цена/остаток/филиал отклоняются либо нормализуются сервером; UI показывает пересчёт до подтверждения.

Изменение: Цена/название/остаток/филиал определяются серверными offers/branches в фиксированной организации. Quote до подтверждения, проверка актуальности, транзакционные holds, запрет подмены сумм и дробных/отрицательных количеств.

Компоненты: `scripts/server/order-trust.ts`, `scripts/server/orders.ts`, `scripts/app-server.ts`, `scripts/db/schema.sql`, `src/lib/api/orders.ts`, `app/checkout/index.tsx`.

Commits: 05eea73, 8f9d7d7, 207877c, e5d6644, ae18b5e.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/http-security.json](evidence/http-security.json), [evidence/ui-flows.json](evidence/ui-flows.json), [evidence/screenshots/flow-trusted-quote.png](evidence/screenshots/flow-trusted-quote.png).

Граница результата / препятствие: Проверено на изолированном authoritative inventory fixture. Реальный POS/Bazaar adapter не подключён; production оформление не готово (EX-02).

## D04 — Параллельный повтор заказа возвращает SQL ошибку 500

**FIXED & VERIFIED**. Исходное поведение: Статусы 201/500/500/500; один заказ сохранён; в JSON раскрыто имя unique constraint. Дубля по одинаковому ключу нет.

Приёмка: 20 контролируемых параллельных повторов дают один ID; ни одного 5xx и деталей SQL.

Изменение: Advisory transaction lock account+key сериализует одинаковые запросы; повторное чтение использует занятый DB client, без pool deadlock. Общий5xx ответ не раскрывает SQL.

Компоненты: `scripts/server/orders.ts`, `scripts/app-server.ts`.

Commits: 8f9d7d7, 207877c, e5d6644, ae18b5e.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/http-security.json](evidence/http-security.json).

Граница результата / препятствие: 20 параллельных HTTP повторов:1×201+19×200, один ID и одна запись; ни одного5xx.

## D05 — Изменённый заказ под прежним ключом молча принимается

**FIXED & VERIFIED**. Исходное поведение: 200 со старым итогом 9.99; новый payload игнорируется без сообщения.

Приёмка: Тот же body → тот же ID; изменённый body → 409, без новой записи.

Изменение: Сохраняется canonical request_hash. Новый payload под прежним ключом даёт409; прежний payload возвращает прежний заказ даже после изменения данных offers.

Компоненты: `scripts/server/orders.ts`, `scripts/db/schema.sql`, `src/lib/orders/checkoutAttempt.ts`.

Commits: 207877c, e5d6644, ae18b5e.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/http-security.json](evidence/http-security.json).

Граница результата / препятствие: Legacy request_hash=NULL не угадывается: конфликт и проверка истории.

## D06 — Нет пользовательского пути удаления аккаунта

**BLOCKED**. Исходное поведение: В профиле есть только выход; deletion UI/API не найден, DELETE /profile →404. Веб-ресурс удаления владельцем не предоставлен.

Приёмка: Удаление тестового аккаунта проходит на Android/iOS и web-странице; вход старым токеном невозможен; сохранённые по обязательствам данные перечислены.

Изменение: Удаление UI/API/web: пароль, bound OTP, текущая версия deletion policy, реальные DELETE/отзыв сессий/media adapter; чужие операции сохраняются. Проверены rollback при ошибке media, остатки, receipts/returns/rewards/audit и web cleanup.

Компоненты: `scripts/server/deletion.ts`, `scripts/app-server.ts`, `app/delete-account.tsx`, `src/hooks/useAuth.tsx`.

Commits: a135f73, f118336, 8f9d7d7, 207877c, e5d6644, ae18b5e.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/ui-flows.json](evidence/ui-flows.json), [evidence/screenshots/flow-deletion-confirmation.png](evidence/screenshots/flow-deletion-confirmation.png), [evidence/screenshots/flow-deletion-complete.png](evidence/screenshots/flow-deletion-complete.png).

Граница результата / препятствие: Нет утверждённой retention/deletion policy, реальных SMS/media/external-copy проверок и Android/iOS устройства. По исходной приёмке D06 нельзя закрыть только web.

## D07 — В интерфейсе отсутствует доступная политика приватности

**BLOCKED**. Исходное поведение: Ссылки нет; о приложении показывает поддержку и 2GIS. Наличие текста вне репозитория не установлено.

Приёмка: Ссылки доступны без авторизации; содержание соответствует сетевому наблюдению release и анкетам магазинов.

Изменение: Гостевые/profile/registration links и версионный reader privacy/terms/support реализованы. TEST тексты только в изолированной БД; юридические проекты вынесены отдельно.

Компоненты: `app/legal/[kind].tsx`, `src/components/LegalLinks.tsx`, `scripts/server/documents.ts`, `app/profile/about.tsx`.

Commits: 207877c.

Повторные проверки: [evidence/gallery.json](evidence/gallery.json), [evidence/screenshots/guest-legal-privacy.png](evidence/screenshots/guest-legal-privacy.png).

Граница результата / препятствие: Нужны утверждённые тексты, публичные URL, release network inventory и store privacy forms. TEST документ не является действующей policy.

## D08 — Согласие с правилами лояльности без доступа к самим правилам

**BLOCKED**. Исходное поведение: Checkbox только меняет boolean; нет экрана/ссылки правил. README прямо называет ставки, уровни и условия пилотными.

Приёмка: Пользователь читает условия до checkbox; backend хранит версию принятого документа; пилотные значения не обещаны как утверждённые.

Изменение: Ссылки на правила до согласия; сервер требует текущие approved privacy/loyalty versions и сохраняет их вместе с согласием. Ставки/пороги/округление не изменены.

Компоненты: `scripts/server/plumbers.ts`, `scripts/server/documents.ts`, `app/(auth)/register.tsx`, `app/plumber/apply.tsx`.

Commits: 05eea73, 207877c, ae18b5e.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/loyalty-existing.log](evidence/loyalty-existing.log), [evidence/gallery.json](evidence/gallery.json).

Граница результата / препятствие: Коммерческие правила и юридические условия не утверждены. Pilot settings/benefits не считаются согласованными; публикация/активация до согласования запрещена.

## D09 — Выбранный филиал расходится с карточкой 2GIS

**BLOCKED**. Исходное поведение: В 2GIS адрес Орозбекова 354 и 09:00–20:00; карточка — Безымянная 20/4 и 09:00–18:00. Контакты тоже различаются.

Приёмка: Все 6 вариантов, карта и внешний переход ведут к согласованному филиалу; телефон и часы утверждены.

Изменение: Исправлено5 ошибочных firm ID из6. Все6 внешних ссылок используют конкретный firm; адреса сверены по официальным страницам. Неутверждённые одинаковые часы убраны, общий телефон обозначен как поддержка.

Компоненты: `src/data/stores.ts`, `src/components/StoreCard.tsx`, `src/components/maps/mapSource.ts`.

Commits: 05eea73.

Повторные проверки: [evidence/gallery.json](evidence/gallery.json), [evidence/screenshots/guest-maps.png](evidence/screenshots/guest-maps.png).

Граница результата / препятствие: Нужно подтверждение владельцем адресов/контактов/часов и native внешнего перехода. Полная исходная приёмка пока не выполнена; источники в MAP_SOURCES.md.

## D10 — Popup карты обрезан; собственные плашки перекрывают виджет

**BLOCKED**. Исходное поведение: Popup выходит за правый край и обрезан; label и widgetCtaCover конкурируют с содержимым. Юридическое нарушение атрибуции не установлено.

Приёмка: На 320/390/430 и native нет обрезки активных данных, атрибуция читается, жесты и fallback работают.

Изменение: Карта на всю ширину с фиксированным viewport, отдельный selector/card, timeout/retry/external fallback; атрибуция сохранена, перекрывающие элементы удалены.

Компоненты: `src/components/maps/TwoGisMap.tsx`, `src/components/maps/TwoGisMap.web.tsx`, `app/(tabs)/maps/index.tsx`.

Commits: 05eea73.

Повторные проверки: [evidence/gallery.json](evidence/gallery.json), [evidence/screenshots/guest-maps.png](evidence/screenshots/guest-maps.png), [evidence/screenshots/large-map.png](evidence/screenshots/large-map.png).

Граница результата / препятствие: Внешний 2GIS widget продолжает обрезать popup на узком экране. Нужна поддерживаемая responsive SDK интеграция с предоставленным ключом/координатами; native жесты/геолокация/отказ не проверены. Это не FIXED.

## D11 — История лояльности показывает одну операцию вместо полного журнала

**FIXED & VERIFIED**. Исходное поведение: Без limit — 1 запись, с limit=100 —9; UI limit не передаёт и пагинации не содержит.

Приёмка: 9 записей видны полностью; набор >100 пролистывается без потерь и повторов; сумма журнала сверяется с балансом.

Изменение: Исправлен default limit1 из Number(null). Cursor pagination timestamp+ID без потери микросекунд, фильтры/сортировка сервера, infinite UI и Показать ещё.

Компоненты: `scripts/app-server.ts`, `scripts/server/loyalty.ts`, `src/lib/api/program.ts`, `src/hooks/useProgram.ts`, `app/plumber/history.tsx`.

Commits: 05eea73, 8f9d7d7, 207877c, d969620, e5d6644, ae18b5e.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/http-security.json](evidence/http-security.json), [evidence/ui-flows.json](evidence/ui-flows.json), [evidence/screenshots/flow-ledger-last-page.png](evidence/screenshots/flow-ledger-last-page.png).

Граница результата / препятствие: 137 реальных операций в тестовом ledger,5 страниц, нет повторов/потерь, сумма сверена с балансом. Production балансы не менялись.

## D12 — Публичный каталог визуально заполнен заглушками

**BLOCKED**. Исходное поведение: В выборке 50/50 без фото, категорий, описания и положительной цены. Популярный блок показывает 2 доступных товара с «Цена уточняется». /categories возвращает404, предусмотрен fallback.

Приёмка: Утверждённая выборка ключевых SKU заполнена; пустые поля не занимают большую часть экрана; критерии достаточности ассортимента утверждены.

Изменение: Сокращён пустой image block, исправлен error fallback и contain; global catalog sorting/pagination проверены на137 fixtures. Реальные фото/описания не выдумывались.

Компоненты: `src/components/ProductCard.tsx`, `app/product/[id].tsx`, `src/lib/bazaar/completeCatalog.ts`, `src/lib/bazaar/client.ts`.

Commits: 05eea73, f118336.

Повторные проверки: [evidence/real-api-readonly.json](evidence/real-api-readonly.json), [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/gallery.json](evidence/gallery.json).

Граница результата / препятствие: Повторный GET:50/50 товаров без фото/описания/категории/ненулевой цены; общий total2365, baseline2362. Нужны владелец каталога, доступ к source pipeline и утверждённая выборка SKU.

## D13 — Светлый вспомогательный текст имеет низкий контраст

**FIXED & VERIFIED**. Исходное поведение: textSubtle #9CA3AF даёт2.539:1; основной оранжевый #E8380D с белым4.198:1. Это измерение токенов, не утверждение о полном WCAG аудите.

Приёмка: Значимый обычный текст ≥4.5:1, крупный ≥3:1; исключения отдельно обоснованы и проверены на устройствах.

Изменение: Увеличен контраст текста primary/muted/subtle/success/warning/danger; проверено12 значимых пар, минимальная из проверенных≥4.5:1.

Компоненты: `src/constants/theme.ts`, `src/components/AppInput.tsx`, `src/components/AppButton.tsx`.

Commits: a135f73, 05eea73.

Повторные проверки: [evidence/contrast.json](evidence/contrast.json), [evidence/gallery.json](evidence/gallery.json).

Граница результата / препятствие: Метод исходного критерия: расчёт токенов + web screenshots. Полные native large-font/TalkBack/VoiceOver проверки не закрыты.

## D14 — Пользователю предлагают вставлять HTTPS URL фотографии

**BLOCKED**. Исходное поведение: Поле «HTTPS-ссылка на фото» переносит техническую задачу загрузки на пользователя.

Приёмка: Пользователь прикрепляет/удаляет фото без URL; проверены размер, отказ разрешений и ошибка загрузки.

Изменение: URL inputs заменены системным picker/upload/preview/removal из формы. API проверяет размер/type и ownership. Defined media adapter требует decode/re-encode/EXIF cleanup и delete.

Компоненты: `src/components/PhotoAttachment.tsx`, `scripts/server/media.ts`, `scripts/app-server.ts`, `app/plumber/apply.tsx`, `app/find-plumber/index.tsx`.

Commits: 05eea73, 8f9d7d7, 207877c, e5d6644, ae18b5e.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/gallery.json](evidence/gallery.json).

Граница результата / препятствие: Нет подключённого реального media storage/decoder и устройства для отказа/ограниченной библиотеки. Local fake adapter не подтверждает provider readiness.

## D15 — Русская локализация содержит технический текст и неправильные формы

**FIXED & VERIFIED**. Исходное поведение: «1 бонусов», «3 бонусов», «4 бонусов»; admin показывает pending/sent и буквальные \n.

Приёмка: Проверены0/1/2/4/5/11/21/1.01, все статусы переведены, нет литерального \n.

Изменение: Склонение бонусов целыми minor units, товаров/позиций и стажа; переводы notification/reward/profile статусов, реальный newline вместо literal\n.

Компоненты: `src/lib/programFormat.ts`, `src/lib/formatters.ts`, `src/components/OrderCard.tsx`, `src/components/CategoryCard.tsx`, `app/orders/[id].tsx`, `app/(tabs)/catalog/index.tsx`, `app/admin/index.tsx`, `app/(tabs)/profile/index.tsx`.

Commits: 5b8ea84, 05eea73, f118336, 207877c.

Повторные проверки: [evidence/regression-suite.log](evidence/regression-suite.log), [evidence/gallery.json](evidence/gallery.json), [evidence/screenshots/plumber-plumber-history.png](evidence/screenshots/plumber-plumber-history.png).

Граница результата / препятствие: Проверены0/1/2/4/5/11/21/1.01 и видимые состояния; исходный метод CODE+WEB.

## D16 — Для единичного выбора фото запрошен READ_MEDIA_IMAGES

**IMPLEMENTED, NOT VERIFIED**. Исходное поведение: READ_MEDIA_IMAGES явно объявлен; prebuild также содержит WRITE_SETTINGS, SYSTEM_ALERT_WINDOW и legacy storage — их финальное слияние ещё не проверено.

Приёмка: Итоговый AAB не содержит необоснованных разрешений; фото выбирается без широкого доступа; отказ не блокирует каталог.

Изменение: Одиночный системный picker без broad library request. Blocked media/storage/settings/overlay/audio; после анализа merged manifest также исключены unused biometric/vibration.

Компоненты: `app.json`, `app/image-search/index.tsx`, `src/components/PhotoAttachment.tsx`.

Commits: ce3107f, 1640709, 05eea73, 207877c.

Повторные проверки: [evidence/android-aab-manifest.xml](evidence/android-aab-manifest.xml), [evidence/android-permissions.txt](evidence/android-permissions.txt), [evidence/android-artifacts.json](evidence/android-artifacts.json).

Граница результата / препятствие: Итоговый manifest/сборка проверены отдельно; выбор фото/camera denial/каталог на Android release device не выполнены. Не закрывать исходный критерий целиком.

## D17 — Локальный rate limit обходится X-Forwarded-For

**IMPLEMENTED, NOT VERIFIED**. Исходное поведение: После429 подмена заголовка даёт401 и обработку запроса. Поведение Railway proxy не проверялось.

Приёмка: В staging spoof header не сбрасывает лимит; рестарт/несколько replicas сохраняют ограничения.

Изменение: Доверенный идентификатор — socket peer; произвольный X-Forwarded-For игнорируется. Атомарный общий DB rate limit переживает process restart и replicas.

Компоненты: `scripts/server/security.ts`, `scripts/app-server.ts`, `scripts/db/schema.sql`.

Commits: 8f9d7d7, 207877c, e5d6644, ae18b5e.

Повторные проверки: [evidence/http-security.json](evidence/http-security.json), [evidence/replica-rate-limit.json](evidence/replica-rate-limit.json).

Граница результата / препятствие: Два локальных процесса + restart прошли. Исходная приёмка требует staging proxy/replicas; нет доступа. За reverse proxy требуется проверить общий IP bucket/capacity, а не снова доверять заголовку.

## D18 — Другой rewardId под прежним ключом незаметно возвращал старую награду

**FIXED & VERIFIED**. Исходное поведение: Same clientRequestId, different rewardId returned the first redemption.

Приёмка: Другой rewardId →409;20 одинаковых повторов →один ID/одно списание.

Изменение: Добавлена проверка reward_id до idempotent replay.

Компоненты: `scripts/server/loyalty.ts`.

Commits: d969620.

Повторные проверки: [evidence/D18-before.json](evidence/D18-before.json), [evidence/regression-suite.log](evidence/regression-suite.log).

Граница результата / препятствие: Physical/staging gates outside the stated local/web method remain in CRITERIA.

## D19 — Состояния выбора не попадали в web accessibility API

**FIXED & VERIFIED**. Исходное поведение: При первом прогоне новый selector визуально закрывался, но aria-expanded отсутствовал; accessibilityState не переносится react-native-web0.21. Исходные radio/checkbox использовали тот же механизм.

Приёмка: Открытие/закрытие и checked состояния доступны в DOM; Escape сохраняет выбор.

Изменение: Явные aria-expanded/checked/selected/busy/disabled; корректные radio semantics, подписи inputs.

Компоненты: `src/components/SelectField.tsx`, `src/components/AppInput.tsx`, `src/components/AppButton.tsx`, `app/checkout/index.tsx`.

Commits: 05eea73, e5d6644.

Повторные проверки: [evidence/ui-flows.json](evidence/ui-flows.json), [evidence/screenshots/flow-select-search.png](evidence/screenshots/flow-select-search.png).

Граница результата / препятствие: Physical/staging gates outside the stated local/web method remain in CRITERIA.

## D20 — Параллельные изменения локальной корзины теряли количество

**FIXED & VERIFIED**. Исходное поведение: Реальный модуль baseline c88450a:20 одновременных add дают quantity1 вместо20.

Приёмка: 20 add сохраняются; consume+add+replay вычитает отправленное один раз; clear ждёт предыдущие мутации.

Изменение: Хранилище сериализует read-modify-write, cart/applied key сохраняются одним значением.

Компоненты: `src/lib/cart/cartStore.ts`, `src/lib/cart/localCart.ts`, `src/hooks/useAuth.tsx`.

Commits: f118336, e5d6644, ae18b5e.

Повторные проверки: [evidence/D20-before.json](evidence/D20-before.json), [evidence/regression-suite.log](evidence/regression-suite.log).

Граница результата / препятствие: Physical/staging gates outside the stated local/web method remain in CRITERIA.

## D21 — Отсутствующая API-конфигурация молча выбирала production

**FIXED & VERIFIED**. Исходное поведение: Baseline env module без EXPO_PUBLIC_API_URL возвращал production Railway URL. Ошибка имени переменной не останавливала подключение.

Приёмка: Без config URL пустой; production build gate отклоняет missing/http/test/debug config; embedded native URL проверен.

Изменение: Удалён implicit production fallback; добавлен EAS pre-install/ручной validator и явные build endpoints.

Компоненты: `src/lib/config/env.ts`, `scripts/build/verify-env.cjs`, `package.json`.

Commits: 1640709.

Повторные проверки: [evidence/release-env.json](evidence/release-env.json), [evidence/android-artifacts.json](evidence/android-artifacts.json).

Граница результата / препятствие: Physical/staging gates outside the stated local/web method remain in CRITERIA.
