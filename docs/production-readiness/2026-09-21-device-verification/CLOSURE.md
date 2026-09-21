# Реестр закрытия — исходные ID сохранены

Все17 исходных дефектов и11 исходных release blockers учтены. Status обозначает приёмку конкретного дефекта, а не готовность платформы. Нативные/эксплуатационные gates остаются в CRITERIA.

|ID|Дефект|Исходный блокер|Статус|
|---|---|---|---|
|D01|Самоназначение администратора через непроверенный телефон|Да|FIXED & VERIFIED|
|D02|Оформление ведёт на несуществующий заказ; детали существующего пустые|Да|FIXED & VERIFIED|
|D03|Сервер принимает произвольные цену, количество и филиал заказа|Да|FIXED & VERIFIED|
|D04|Параллельный повтор заказа возвращает SQL ошибку 500|Нет|FIXED & VERIFIED|
|D05|Изменённый заказ под прежним ключом молча принимается|Нет|FIXED & VERIFIED|
|D06|Нет пользовательского пути удаления аккаунта|Да|BLOCKED|
|D07|В интерфейсе отсутствует доступная политика приватности|Да|BLOCKED|
|D08|Согласие с правилами лояльности без доступа к самим правилам|Да|BLOCKED|
|D09|Выбранный филиал расходится с карточкой 2GIS|Да|BLOCKED|
|D10|Popup карты обрезан; собственные плашки перекрывают виджет|Да|FIXED & VERIFIED|
|D11|История лояльности показывает одну операцию вместо полного журнала|Да|FIXED & VERIFIED|
|D12|Публичный каталог визуально заполнен заглушками|Да|BLOCKED|
|D13|Светлый вспомогательный текст имеет низкий контраст|Нет|FIXED & VERIFIED|
|D14|Пользователю предлагают вставлять HTTPS URL фотографии|Нет|BLOCKED|
|D15|Русская локализация содержит технический текст и неправильные формы|Нет|FIXED & VERIFIED|
|D16|Для единичного выбора фото запрошен READ_MEDIA_IMAGES|Да|FIXED & VERIFIED|
|D17|Локальный rate limit обходится X-Forwarded-For|Нет|IMPLEMENTED, NOT VERIFIED|
|D18|Другой rewardId под прежним ключом незаметно возвращал старую награду|Нет|FIXED & VERIFIED|
|D19|Состояния выбора не попадали в web accessibility API|Нет|FIXED & VERIFIED|
|D20|Параллельные изменения локальной корзины теряли количество|Нет|FIXED & VERIFIED|
|D21|Отсутствующая API-конфигурация молча выбирала production|Нет|FIXED & VERIFIED|
|D22|Недоступный товар ошибочно считался доступным|Нет|FIXED & VERIFIED|
|D23|Повтор обмена после потери ответа создавал новое списание бонусов|Да|FIXED & VERIFIED|
|D24|Кнопки «Назад» в native имеют glyph-only имя и малую область нажатия|Нет|FIXED & VERIFIED|
|D25|Adaptive launcher icon обрезает бренд в системной маске Redmi|Нет|FIXED & VERIFIED|
|D26|Посимвольный ввод телефона дублирует +996 и не даёт очистить префикс|Нет|FIXED & VERIFIED|
|D27|Первый экран «Все товары» ожидает24 мобильных запросов полного каталога|Нет|FIXED & VERIFIED|
|D28|System font scale change clips text and resets unfinished form|Да|FIXED & VERIFIED|
|D29|Android system navigation overlaps checkout action at large font|Да|FIXED & VERIFIED|
|D30|Рабочий backend остаётся старым proxy; Telegram webhook отсутствует|Да|FIXED & VERIFIED|
|D31|Повтор Telegram callback ошибочно возвращает500 после уже применённого статуса|Нет|FIXED & VERIFIED|
|D32|Telegram worker и callback не ограничены организацией заказа|Да|FIXED & VERIFIED|
|D33|Health показывает готовность после неудачной регистрации webhook|Да|FIXED & VERIFIED|
|D34|Android Photo Picker fails after Activity recreation|Да|FIXED & VERIFIED|
|D35|Вход теряет исходное назначение; гостевое оформление не предлагает авторизацию|Нет|FIXED & VERIFIED|
|D36|Android history filters and cursor are silently omitted from requests|Да|FIXED & VERIFIED|
|D37|Android clips the interface after a live display-density change|Да|FIXED & VERIFIED|
|D38|Мобильный каталог читает прежний Bazaar источник вместо общей базы сайта|Да|FIXED & VERIFIED|
|D39|Нижняя навигация перекрывает zoom карты на компактном Android|Да|FIXED & VERIFIED|
|D40|Partial migrations cannot upgrade the actual production legacy schema|Да|FIXED & VERIFIED|
|D41|Isolated production build omitted application routes despite successful Gradle build|Да|FIXED & VERIFIED|

## D01 — Самоназначение администратора через непроверенный телефон

**FIXED & VERIFIED** · P0 · Общий backend → Android/iOS

Исходное поведение: Оба пути дают isAdmin=true и HTTP 200 защищённого admin API без проверки владения номером.

Критерий: Оба сценария возвращают 403; роль не меняется; администратор выдаёт доступ аудируемой операцией; проверить все admin mutation endpoints.

Изменение: Самоназначение по телефону/allowlist закрыто; действующая DB-role — единственный источник admin. По новому требованию вход/регистрация phone+password без SMS; entered phone не verified. Ротация/отзыв сессий и защита от восстановления отозванной роли сохранены. Все 26 admin method/path закрыты для guest/customer. Recovery256-bit single-use/30min/hash-only, пароль администратора + review note, rate limits, account-first locks.

Коммиты: `a135f73`, `f118336`, `8f9d7d7`, `207877c`, `e5d6644`, `ae18b5e`, `f471a16`.

Компоненты: `scripts/server/auth.ts`, `scripts/server/security.ts`, `scripts/server/admin-roles.ts`, `scripts/app-server.ts`, `src/hooks/useAuth.tsx`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json); [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json); [evidence/regression-final.log](evidence/regression-final.log); [evidence/http-security.json](evidence/http-security.json); [evidence/recovery-ui.json](evidence/recovery-ui.json).

Остаточное условие: Production admin/legacy-session incident review EX-04 и реальная ручная поддержка EX-05 остаются BLOCKED; телефонная проверка отменена владельцем, а не заменена trusted verified=true.

## D02 — Оформление ведёт на несуществующий заказ; детали существующего пустые

**FIXED & VERIFIED** · P1 · Общий клиент; runtime WEB, native не запущен

Исходное поведение: Заказ сохранён, но переход /orders/local-… даёт 404. Реальный ID показывает 0 товаров, «Покупатель», пустые контакты и выдуманный fallback статуса.

Критерий: Сквозное создание и чтение заказа/резерва сохраняет реальный ID, все поля и timeline; контрактный тест на фактический envelope.

Изменение: Адаптер читает фактический data envelope, сохраняет серверный ID и поля. Убраны fabricated local IDs. Проверена потеря201 ответа, restart/retry, один заказ, очистка корзины, история и повторное открытие. 21.09: физический Android loss-after-COMMIT→force-stop→тот же заказ/ключ, один SQL insert и согласованный резерв; корзина очищена, история видна. Сообщение неопределённого результата уточнено, суммы локализованы.

Коммиты: `05eea73`, `e5d6644`, `0d6d6df`.

Компоненты: `src/lib/bazaar/adapters.ts`, `src/lib/api/orders.ts`, `src/lib/orders/checkoutAttempt.ts`, `app/checkout/index.tsx`, `src/hooks/useOrders.ts`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json); [../2026-09-18-remediation/evidence/screenshots/flow-order-confirmed.png](../2026-09-18-remediation/evidence/screenshots/flow-order-confirmed.png); [../2026-09-18-remediation/evidence/screenshots/flow-order-reopened.png](../2026-09-18-remediation/evidence/screenshots/flow-order-reopened.png); [evidence/native-order-recovery.json](evidence/native-order-recovery.json); [evidence/checkout-final.json](evidence/checkout-final.json); [evidence/screenshots/native-order-confirmed.png](evidence/screenshots/native-order-confirmed.png).

Остаточное условие: Android standalone QA проверен с trusted fixtures; production inventory/POS и iOS остаются отдельными gates.

## D03 — Сервер принимает произвольные цену, количество и филиал заказа

**FIXED & VERIFIED** · P1 · Общий backend

Исходное поведение: HTTP 201, итог 9.99, 999 единиц и несуществующий филиал сохранены. В проекте заказы подтверждаются менеджером: списание реальных денег не доказано.

Критерий: Подменённые цена/остаток/филиал отклоняются либо нормализуются сервером; UI показывает пересчёт до подтверждения.

Изменение: Цена/название/остаток/филиал определяются серверными offers/branches в фиксированной организации. Quote до подтверждения, проверка актуальности, транзакционные holds, запрет подмены сумм и дробных/отрицательных количеств.

Коммиты: `05eea73`, `8f9d7d7`, `207877c`, `e5d6644`, `ae18b5e`.

Компоненты: `scripts/server/order-trust.ts`, `scripts/server/orders.ts`, `scripts/app-server.ts`, `scripts/db/schema.sql`, `src/lib/api/orders.ts`, `app/checkout/index.tsx`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json); [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json); [../2026-09-18-remediation/evidence/screenshots/flow-trusted-quote.png](../2026-09-18-remediation/evidence/screenshots/flow-trusted-quote.png).

Остаточное условие: Проверено на изолированном authoritative inventory fixture. Реальный POS/Bazaar adapter не подключён; production оформление не готово (EX-02).

## D04 — Параллельный повтор заказа возвращает SQL ошибку 500

**FIXED & VERIFIED** · P2 · Общий backend

Исходное поведение: Статусы 201/500/500/500; один заказ сохранён; в JSON раскрыто имя unique constraint. Дубля по одинаковому ключу нет.

Критерий: 20 контролируемых параллельных повторов дают один ID; ни одного 5xx и деталей SQL.

Изменение: Advisory transaction lock account+key сериализует одинаковые запросы; повторное чтение использует занятый DB client, без pool deadlock. Общий5xx ответ не раскрывает SQL.

Коммиты: `8f9d7d7`, `207877c`, `e5d6644`, `ae18b5e`.

Компоненты: `scripts/server/orders.ts`, `scripts/app-server.ts`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json).

Остаточное условие: 20 параллельных HTTP повторов:1×201+19×200, один ID и одна запись; ни одного5xx.

## D05 — Изменённый заказ под прежним ключом молча принимается

**FIXED & VERIFIED** · P2 · Общий backend

Исходное поведение: 200 со старым итогом 9.99; новый payload игнорируется без сообщения.

Критерий: Тот же body → тот же ID; изменённый body → 409, без новой записи.

Изменение: Сохраняется canonical request_hash. Новый payload под прежним ключом даёт409; прежний payload возвращает прежний заказ даже после изменения данных offers.

Коммиты: `207877c`, `e5d6644`, `ae18b5e`.

Компоненты: `scripts/server/orders.ts`, `scripts/db/schema.sql`, `src/lib/orders/checkoutAttempt.ts`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json).

Остаточное условие: Legacy request_hash=NULL не угадывается: конфликт и проверка истории.

## D06 — Нет пользовательского пути удаления аккаунта

**BLOCKED** · P1 · Обе платформы по общему коду

Исходное поведение: В профиле есть только выход; deletion UI/API не найден, DELETE /profile →404. Веб-ресурс удаления владельцем не предоставлен.

Критерий: Удаление тестового аккаунта проходит на Android/iOS и web-странице; вход старым токеном невозможен; сохранённые по обязательствам данные перечислены.

Изменение: Удаление UI/API/web требует текущий пароль, явное согласие и текущую approved deletion policy; реальные DELETE, отзыв сессий, очистка local storage и media adapter. Проверены rollback/ownership и web cleanup. SMS отменён владельцем; обязательства retention/внешнего удаления должны быть утверждены до активации.

Коммиты: `a135f73`, `f118336`, `8f9d7d7`, `207877c`, `e5d6644`, `ae18b5e`, `f471a16`.

Компоненты: `scripts/server/deletion.ts`, `scripts/app-server.ts`, `app/delete-account.tsx`, `src/hooks/useAuth.tsx`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json); [../2026-09-18-remediation/evidence/screenshots/flow-deletion-confirmation.png](../2026-09-18-remediation/evidence/screenshots/flow-deletion-confirmation.png); [../2026-09-18-remediation/evidence/screenshots/flow-deletion-complete.png](../2026-09-18-remediation/evidence/screenshots/flow-deletion-complete.png); [evidence/web-ui-flows.json](evidence/web-ui-flows.json); [evidence/regression-final.log](evidence/regression-final.log).

Остаточное условие: Утверждённые retention/deletion условия и внешнее media удаление не подтверждены. HTTPS /delete-account уже опубликован в admin-web, но безопасно блокирует удаление без approved policy; TEST документы не действующие условия.

## D07 — В интерфейсе отсутствует доступная политика приватности

**BLOCKED** · P1 · Обе платформы по общим экранам

Исходное поведение: Ссылки нет; о приложении показывает поддержку и 2GIS. Наличие текста вне репозитория не установлено.

Критерий: Ссылки доступны без авторизации; содержание соответствует сетевому наблюдению release и анкетам магазинов.

Изменение: Гостевые/profile/registration links и версионный reader privacy/terms/support реализованы. TEST тексты только в изолированной БД; юридические проекты вынесены отдельно.

Коммиты: `207877c`.

Компоненты: `app/legal/[kind].tsx`, `src/components/LegalLinks.tsx`, `scripts/server/documents.ts`, `app/profile/about.tsx`.

Проверки: [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json); [../2026-09-18-remediation/evidence/screenshots/guest-legal-privacy.png](../2026-09-18-remediation/evidence/screenshots/guest-legal-privacy.png).

Остаточное условие: Нужны утверждённые тексты, публичные URL, release network inventory и store privacy forms. TEST документ не является действующей policy.

## D08 — Согласие с правилами лояльности без доступа к самим правилам

**BLOCKED** · P1 · Общие формы

Исходное поведение: Checkbox только меняет boolean; нет экрана/ссылки правил. README прямо называет ставки, уровни и условия пилотными.

Критерий: Пользователь читает условия до checkbox; backend хранит версию принятого документа; пилотные значения не обещаны как утверждённые.

Изменение: Ссылки на правила до согласия; сервер требует текущие approved privacy/loyalty versions и сохраняет их вместе с согласием. Ставки/пороги/округление не изменены.

Коммиты: `05eea73`, `207877c`, `ae18b5e`.

Компоненты: `scripts/server/plumbers.ts`, `scripts/server/documents.ts`, `app/(auth)/register.tsx`, `app/plumber/apply.tsx`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/loyalty-existing.log](../2026-09-18-remediation/evidence/loyalty-existing.log); [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json).

Остаточное условие: Коммерческие правила и юридические условия не утверждены. Pilot settings/benefits не считаются согласованными; публикация/активация до согласования запрещена.

## D09 — Выбранный филиал расходится с карточкой 2GIS

**BLOCKED** · P1 · Общий справочник; WEB runtime

Исходное поведение: В 2GIS адрес Орозбекова 354 и 09:00–20:00; карточка — Безымянная 20/4 и 09:00–18:00. Контакты тоже различаются.

Критерий: Все 6 вариантов, карта и внешний переход ведут к согласованному филиалу; телефон и часы утверждены.

Изменение: Исправлено5 ошибочных firm ID из6. Все6 внешних ссылок используют конкретный firm; адреса сверены по официальным страницам. Неутверждённые одинаковые часы убраны, общий телефон обозначен как поддержка. Подтверждены координаты6 точек; адрес Баткена обновлён согласно текущей публичной карточке.

Коммиты: `05eea73`, `a2178f3`.

Компоненты: `src/data/stores.ts`, `src/components/StoreCard.tsx`, `src/components/maps/mapSource.ts`.

Проверки: [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json); [../2026-09-18-remediation/evidence/screenshots/guest-maps.png](../2026-09-18-remediation/evidence/screenshots/guest-maps.png); [../2026-09-18-followup/evidence/branch-coordinates.json](../2026-09-18-followup/evidence/branch-coordinates.json); [evidence/screenshots/map-return-from-external.png](evidence/screenshots/map-return-from-external.png).

Остаточное условие: Владелец должен подтвердить адреса, контакты и часы филиалов. Выбранный филиал открывает установленный 2GIS на Redmi; iOS не проверен.

## D10 — Popup карты обрезан; собственные плашки перекрывают виджет

**FIXED & VERIFIED** · P2 · WEB; общий подход в native требует повтора

Исходное поведение: Popup выходит за правый край и обрезан; label и widgetCtaCover конкурируют с содержимым. Юридическое нарушение атрибуции не установлено.

Критерий: На 320/390/430 и native нет обрезки активных данных, атрибуция читается, жесты и fallback работают.

Изменение: Неприспосабливаемый 2GIS iframe заменён Leaflet/OSM с подтверждёнными координатами 6 фирм. Popup ограничен шириной, высота260–390, zoom снизу, атрибуция видна. Сохранены выбор филиала, карточка и внешний переход в 2GIS, timeout/retry.

Коммиты: `05eea73`, `a2178f3`, `6ec5663`, `a0433f7`.

Компоненты: `src/components/maps/TwoGisMap.tsx`, `src/components/maps/TwoGisMap.web.tsx`, `app/(tabs)/maps/index.tsx`, `src/components/maps/mapSource.ts`, `src/data/branchCoordinates.ts`.

Проверки: [../2026-09-18-followup/evidence/visual.json](../2026-09-18-followup/evidence/visual.json); [../2026-09-18-followup/evidence/visual-second-branch.json](../2026-09-18-followup/evidence/visual-second-branch.json); [../2026-09-18-followup/evidence/screenshots/map-320.png](../2026-09-18-followup/evidence/screenshots/map-320.png); [../2026-09-18-followup/evidence/screenshots/map-390.png](../2026-09-18-followup/evidence/screenshots/map-390.png); [../2026-09-18-followup/evidence/screenshots/map-430.png](../2026-09-18-followup/evidence/screenshots/map-430.png); [DEVICE_RUN.md](DEVICE_RUN.md); [evidence/screenshots/map-popup-after.png](evidence/screenshots/map-popup-after.png); [evidence/screenshots/map-selected-dordoy.png](evidence/screenshots/map-selected-dordoy.png); [evidence/screenshots/map-select-empty-keyboard.png](evidence/screenshots/map-select-empty-keyboard.png); [evidence/native-map-network.json](evidence/native-map-network.json); [evidence/screenshots/map-return-from-external.png](evidence/screenshots/map-return-from-external.png); [evidence/native-responsive-final.json](evidence/native-responsive-final.json).

Остаточное условие: Android проверен физически при320/390/430dp; iOS отложен владельцем.

## D11 — История лояльности показывает одну операцию вместо полного журнала

**FIXED & VERIFIED** · P1 · Общий backend/клиент

Исходное поведение: Без limit — 1 запись, с limit=100 —9; UI limit не передаёт и пагинации не содержит.

Критерий: 9 записей видны полностью; набор >100 пролистывается без потерь и повторов; сумма журнала сверяется с балансом.

Изменение: Исправлен default limit1 из Number(null). Cursor pagination timestamp+ID без потери микросекунд, фильтры/сортировка сервера, infinite UI и Показать ещё.

Коммиты: `05eea73`, `8f9d7d7`, `207877c`, `d969620`, `e5d6644`, `ae18b5e`.

Компоненты: `scripts/app-server.ts`, `scripts/server/loyalty.ts`, `src/lib/api/program.ts`, `src/hooks/useProgram.ts`, `app/plumber/history.tsx`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json); [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json); [../2026-09-18-remediation/evidence/screenshots/flow-ledger-last-page.png](../2026-09-18-remediation/evidence/screenshots/flow-ledger-last-page.png); [evidence/web-ui-flows.json](evidence/web-ui-flows.json); [evidence/regression-final.log](evidence/regression-final.log).

Остаточное условие: 137 реальных операций в тестовом ledger,5 страниц, нет повторов/потерь, сумма сверена с балансом. Production балансы не менялись.

## D12 — Публичный каталог визуально заполнен заглушками

**BLOCKED** · P2 · Проверенная выборка каталога

Исходное поведение: В выборке 50/50 без фото, категорий, описания и положительной цены. Популярный блок показывает 2 доступных товара с «Цена уточняется». /categories возвращает404, предусмотрен fallback.

Критерий: Утверждённая выборка ключевых SKU заполнена; пустые поля не занимают большую часть экрана; критерии достаточности ассортимента утверждены.

Изменение: Исправлен error fallback и contain; итоговая image/placeholder зона квадратная по уточнению владельца; global catalog sorting/pagination проверены на137 fixtures. Реальные фото/описания не выдумывались. Исправлены реальные строковые/множественные категории, imageObjects, полный catalog gateway, exact-ID detail и secondary-category filtering. Реальные фото VCLND подтверждены в Android списке и деталях. Photo/placeholder зона1:1; серверная глобальная сортировка/поиск/страницы убирают24 мобильных запроса до первого списка. Исправлен фактический источник (D38): одна DATABASE_URL с сайтом,845 товаров/2147 вариантов,842 изображения, включая5 raster dataURI. 15 выбранных владельцем товаров имеют фото, категории и подтверждённые цены; варианты не смешиваются. 15 imageURLs HTTP200 и Android screenshots.

Коммиты: `05eea73`, `f118336`, `1291e02`, `c9b3992`, `ce3ea6d`, `a34c135`, `1d98374`, `6c933d7`.

Компоненты: `src/components/ProductCard.tsx`, `app/product/[id].tsx`, `src/lib/bazaar/completeCatalog.ts`, `src/lib/bazaar/client.ts`, `scripts/server/catalog.ts`, `src/lib/bazaar/adapters.ts`.

Проверки: [../2026-09-18-remediation/evidence/real-api-readonly.json](../2026-09-18-remediation/evidence/real-api-readonly.json); [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json); [../2026-09-18-followup/evidence/catalog-complete-readonly.json](../2026-09-18-followup/evidence/catalog-complete-readonly.json); [../2026-09-18-followup/evidence/gateway-real-source.json](../2026-09-18-followup/evidence/gateway-real-source.json); [../2026-09-18-followup/evidence/catalog-gateway.json](../2026-09-18-followup/evidence/catalog-gateway.json); [../2026-09-18-followup/evidence/visual.json](../2026-09-18-followup/evidence/visual.json); [evidence/screenshots/all-products-photo-after.png](evidence/screenshots/all-products-photo-after.png); [evidence/screenshots/all-products-placeholder-after.png](evidence/screenshots/all-products-placeholder-after.png); [evidence/product-image-http.json](evidence/product-image-http.json); [evidence/catalog-gateway.json](evidence/catalog-gateway.json); [evidence/storefront-catalog.json](evidence/storefront-catalog.json); [evidence/featured-images-http.json](evidence/featured-images-http.json); [evidence/native-storefront-catalog.json](evidence/native-storefront-catalog.json).

Остаточное условие: Старое утверждение о другой базе неверно: DATABASE_URL совпадает. Код использовал Bazaar вместо Product/Variant таблиц. Источник исправлен и ассортимент подтверждён владельцем; в правильном каталоге3 товара без фото и0 описаний. Исходный критерий подготовленных описаний ещё требует утверждённого контента.

## D13 — Светлый вспомогательный текст имеет низкий контраст

**FIXED & VERIFIED** · P2 · Общие токены; native восприятие не проверено

Исходное поведение: textSubtle #9CA3AF даёт2.539:1; основной оранжевый #E8380D с белым4.198:1. Это измерение токенов, не утверждение о полном WCAG аудите.

Критерий: Значимый обычный текст ≥4.5:1, крупный ≥3:1; исключения отдельно обоснованы и проверены на устройствах.

Изменение: Увеличен контраст текста primary/muted/subtle/success/warning/danger; проверено12 значимых пар, минимальная из проверенных≥4.5:1. На физическом Android дополнительно обнаружен и исправлен D36: native URLSearchParams.size терял filter/cursor. Пустой spent и вторая страница проверены на v11.

Коммиты: `a135f73`, `05eea73`, `06037ef`.

Компоненты: `src/constants/theme.ts`, `src/components/AppInput.tsx`, `src/components/AppButton.tsx`.

Проверки: [../2026-09-18-remediation/evidence/contrast.json](../2026-09-18-remediation/evidence/contrast.json); [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json); [evidence/native-final-pass.json](evidence/native-final-pass.json); [evidence/loyalty-native-query.log](evidence/loyalty-native-query.log).

Остаточное условие: Метод исходного критерия: расчёт токенов + web screenshots. Полные native large-font/TalkBack/VoiceOver проверки не закрыты.

## D14 — Пользователю предлагают вставлять HTTPS URL фотографии

**BLOCKED** · P2 · Формы мастера и заявки

Исходное поведение: Поле «HTTPS-ссылка на фото» переносит техническую задачу загрузки на пользователя.

Критерий: Пользователь прикрепляет/удаляет фото без URL; проверены размер, отказ разрешений и ошибка загрузки.

Изменение: URL inputs заменены системным picker/upload/preview/removal из формы. API проверяет размер/type и ownership. Defined media adapter требует decode/re-encode/EXIF cleanup и delete.

Коммиты: `05eea73`, `8f9d7d7`, `207877c`, `e5d6644`, `ae18b5e`.

Компоненты: `src/components/PhotoAttachment.tsx`, `scripts/server/media.ts`, `scripts/app-server.ts`, `app/plumber/apply.tsx`, `app/find-plumber/index.tsx`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json).

Остаточное условие: Настоящее media storage/decoder не подключено. На Android проверены отказ камеры, выбор собственного QA-файла и отмена; загрузка/удаление во внешнем media storage остаются открытыми.

## D15 — Русская локализация содержит технический текст и неправильные формы

**FIXED & VERIFIED** · P3 · История/кабинет/admin

Исходное поведение: «1 бонусов», «3 бонусов», «4 бонусов»; admin показывает pending/sent и буквальные \n.

Критерий: Проверены0/1/2/4/5/11/21/1.01, все статусы переведены, нет литерального \n.

Изменение: Склонение бонусов целыми minor units, товаров/позиций и стажа; переводы notification/reward/profile статусов, реальный newline вместо literal\n.

Коммиты: `5b8ea84`, `05eea73`, `f118336`, `207877c`, `ce3ea6d`, `6ec5663`, `0d6d6df`.

Компоненты: `src/lib/programFormat.ts`, `src/lib/formatters.ts`, `src/components/OrderCard.tsx`, `src/components/CategoryCard.tsx`, `app/orders/[id].tsx`, `app/(tabs)/catalog/index.tsx`, `app/admin/index.tsx`, `app/(tabs)/profile/index.tsx`.

Проверки: [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log); [../2026-09-18-remediation/evidence/gallery.json](../2026-09-18-remediation/evidence/gallery.json); [../2026-09-18-remediation/evidence/screenshots/plumber-plumber-history.png](../2026-09-18-remediation/evidence/screenshots/plumber-plumber-history.png); [evidence/checkout-final.json](evidence/checkout-final.json).

Остаточное условие: Проверены0/1/2/4/5/11/21/1.01 и видимые состояния; исходный метод CODE+WEB.

## D16 — Для единичного выбора фото запрошен READ_MEDIA_IMAGES

**FIXED & VERIFIED** · P1 · Android

Исходное поведение: READ_MEDIA_IMAGES явно объявлен; prebuild также содержит WRITE_SETTINGS, SYSTEM_ALERT_WINDOW и legacy storage — их финальное слияние ещё не проверено.

Критерий: Итоговый AAB не содержит необоснованных разрешений; фото выбирается без широкого доступа; отказ не блокирует каталог.

Изменение: Одиночный системный picker без broad library request. Blocked media/storage/settings/overlay/audio; после анализа merged manifest также исключены unused biometric/vibration.

Коммиты: `ce3107f`, `1640709`, `05eea73`, `207877c`.

Компоненты: `app.json`, `app/image-search/index.tsx`, `src/components/PhotoAttachment.tsx`.

Проверки: [../2026-09-18-remediation/evidence/android-aab-manifest.xml](../2026-09-18-remediation/evidence/android-aab-manifest.xml); [../2026-09-18-remediation/evidence/android-permissions.txt](../2026-09-18-remediation/evidence/android-permissions.txt); [../2026-09-18-remediation/evidence/android-artifacts.json](../2026-09-18-remediation/evidence/android-artifacts.json); [DEVICE_RUN.md](DEVICE_RUN.md); [evidence/aab-manifest-latest.xml](evidence/aab-manifest-latest.xml); [evidence/native-picker-recreation.json](evidence/native-picker-recreation.json); [evidence/native-camera.json](evidence/native-camera.json).

Остаточное условие: QA AAB v9 inspected: no broad photo/storage permissions. Redmi system picker selected own QA image; camera denial and return to catalog verified. Store-signed internal-track artifact remains a separate Play gate.

## D17 — Локальный rate limit обходится X-Forwarded-For

**IMPLEMENTED, NOT VERIFIED** · P2 · Backend

Исходное поведение: После429 подмена заголовка даёт401 и обработку запроса. Поведение Railway proxy не проверялось.

Критерий: В staging spoof header не сбрасывает лимит; рестарт/несколько replicas сохраняют ограничения.

Изменение: Доверенный идентификатор — socket peer; произвольный X-Forwarded-For игнорируется. Атомарный общий DB rate limit переживает process restart и replicas.

Коммиты: `8f9d7d7`, `207877c`, `e5d6644`, `ae18b5e`.

Компоненты: `scripts/server/security.ts`, `scripts/app-server.ts`, `scripts/db/schema.sql`.

Проверки: [../2026-09-18-remediation/evidence/http-security.json](../2026-09-18-remediation/evidence/http-security.json); [../2026-09-18-remediation/evidence/replica-rate-limit.json](../2026-09-18-remediation/evidence/replica-rate-limit.json); [evidence/http-security.json](evidence/http-security.json); [evidence/regression-final.log](evidence/regression-final.log).

Остаточное условие: Два локальных процесса + restart прошли. Исходная приёмка требует staging proxy/replicas; нет доступа. За reverse proxy требуется проверить общий IP bucket/capacity, а не снова доверять заголовку.

## D18 — Другой rewardId под прежним ключом незаметно возвращал старую награду

**FIXED & VERIFIED** · P2 · Shared/client or local backend; scope stated in evidence

Исходное поведение: Same clientRequestId, different rewardId returned the first redemption.

Критерий: Другой rewardId →409;20 одинаковых повторов →один ID/одно списание.

Изменение: Добавлена проверка reward_id до idempotent replay.

Коммиты: `d969620`.

Компоненты: `scripts/server/loyalty.ts`.

Проверки: [../2026-09-18-remediation/evidence/D18-before.json](../2026-09-18-remediation/evidence/D18-before.json); [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log).

Остаточное условие: Physical/staging gates outside the stated local/web method remain in CRITERIA.

## D19 — Состояния выбора не попадали в web accessibility API

**FIXED & VERIFIED** · P2 · Shared/client or local backend; scope stated in evidence

Исходное поведение: При первом прогоне новый selector визуально закрывался, но aria-expanded отсутствовал; accessibilityState не переносится react-native-web0.21. Исходные radio/checkbox использовали тот же механизм.

Критерий: Открытие/закрытие и checked состояния доступны в DOM; Escape сохраняет выбор.

Изменение: Явные aria-expanded/checked/selected/busy/disabled; корректные radio semantics, подписи inputs.

Коммиты: `05eea73`, `e5d6644`.

Компоненты: `src/components/SelectField.tsx`, `src/components/AppInput.tsx`, `src/components/AppButton.tsx`, `app/checkout/index.tsx`.

Проверки: [../2026-09-18-remediation/evidence/ui-flows.json](../2026-09-18-remediation/evidence/ui-flows.json); [../2026-09-18-remediation/evidence/screenshots/flow-select-search.png](../2026-09-18-remediation/evidence/screenshots/flow-select-search.png).

Остаточное условие: Physical/staging gates outside the stated local/web method remain in CRITERIA.

## D20 — Параллельные изменения локальной корзины теряли количество

**FIXED & VERIFIED** · P2 · Shared/client or local backend; scope stated in evidence

Исходное поведение: Реальный модуль baseline c88450a:20 одновременных add дают quantity1 вместо20.

Критерий: 20 add сохраняются; consume+add+replay вычитает отправленное один раз; clear ждёт предыдущие мутации.

Изменение: Хранилище сериализует read-modify-write, cart/applied key сохраняются одним значением.

Коммиты: `f118336`, `e5d6644`, `ae18b5e`.

Компоненты: `src/lib/cart/cartStore.ts`, `src/lib/cart/localCart.ts`, `src/hooks/useAuth.tsx`.

Проверки: [../2026-09-18-remediation/evidence/D20-before.json](../2026-09-18-remediation/evidence/D20-before.json); [../2026-09-18-remediation/evidence/regression-suite.log](../2026-09-18-remediation/evidence/regression-suite.log).

Остаточное условие: Physical/staging gates outside the stated local/web method remain in CRITERIA.

## D21 — Отсутствующая API-конфигурация молча выбирала production

**FIXED & VERIFIED** · P2 · Shared/client or local backend; scope stated in evidence

Исходное поведение: Baseline env module без EXPO_PUBLIC_API_URL возвращал production Railway URL. Ошибка имени переменной не останавливала подключение.

Критерий: Без config URL пустой; production build gate отклоняет missing/http/test/debug config; embedded native URL проверен.

Изменение: Удалён implicit production fallback; добавлен EAS pre-install/ручной validator и явные build endpoints.

Коммиты: `1640709`.

Компоненты: `src/lib/config/env.ts`, `scripts/build/verify-env.cjs`, `package.json`.

Проверки: [../2026-09-18-remediation/evidence/release-env.json](../2026-09-18-remediation/evidence/release-env.json); [../2026-09-18-remediation/evidence/android-artifacts.json](../2026-09-18-remediation/evidence/android-artifacts.json).

Остаточное условие: Physical/staging gates outside the stated local/web method remain in CRITERIA.

## D22 — Недоступный товар ошибочно считался доступным

**FIXED & VERIFIED** · P2 · Общий адаптер Android/iOS/web

Исходное поведение: В исходном6c40f51 оба случая возвращали inStock=true.

Критерий: Оба исходных и соседние negative-status сценарии возвращают false; положительные случаи каталога не ломаются.

Изменение: Точное сравнение статусов; отрицательные сигналы проверяются первыми.

Коммиты: `1291e02`.

Компоненты: `src/lib/bazaar/adapters.ts`, `scripts/tests/catalog-gateway.ts`.

Проверки: [../2026-09-18-followup/evidence/D22-before.json](../2026-09-18-followup/evidence/D22-before.json); [../2026-09-18-followup/evidence/catalog-gateway.json](../2026-09-18-followup/evidence/catalog-gateway.json); [../2026-09-18-followup/evidence/regression-suite.log](../2026-09-18-followup/evidence/regression-suite.log).

Остаточное условие: Нет в рамках данного критерия.

## D23 — Повтор обмена после потери ответа создавал новое списание бонусов

**FIXED & VERIFIED** · P1 · Общий клиент; runtime WEB + локальная PostgreSQL

Исходное поведение: Старый экран генерировал новый ключ на каждое подтверждение; воспроизведены2 заявки.

Критерий: ПотеряACK/перезапуск/20параллельныхповторов:однаDBзаявка/ledger; подтверждённая квитанция сохраняется до явного действия; другой аккаунт её не видит; отсутствие награды после первого списания не блокирует восстановление.

Изменение: Сохранённая account-scoped попытка, single-flight, повтор исходного ключа, серверный no-operation отказ, квитанция до явного подтверждения и очистка при удалении аккаунта. Ключ сохраняется при обычном выходе, чтобы возврат в тот же аккаунт не создал повтор; токен/телефон не хранятся в попытке.

Коммиты: `615510d`, `9a7b421`.

Компоненты: `src/lib/rewards/rewardAttempt.ts`, `src/hooks/useProgram.ts`, `app/plumber/rewards.tsx`, `app/delete-account.tsx`, `scripts/server/loyalty.ts`, `scripts/tests/reward-attempt.ts`, `scripts/tests/reward-ui.mjs`.

Проверки: [../2026-09-18-followup/evidence/reward-retry.json](../2026-09-18-followup/evidence/reward-retry.json); [../2026-09-18-followup/evidence/reward-ui.json](../2026-09-18-followup/evidence/reward-ui.json); [../2026-09-18-followup/evidence/screenshots/reward-lost-ack.png](../2026-09-18-followup/evidence/screenshots/reward-lost-ack.png); [../2026-09-18-followup/evidence/screenshots/reward-recovered.png](../2026-09-18-followup/evidence/screenshots/reward-recovered.png).

Остаточное условие: Native acceptance остаётся отдельными LOY-20/21/22 PHYSICAL критериями и не засчитан по web.

## D24 — Кнопки «Назад» в native имеют glyph-only имя и малую область нажатия

**FIXED & VERIFIED** · P2 · Android; shared UI

Исходное поведение: ScreenHeader/ProductDetail back определялись глифом; целевой header touch target38dp.

Критерий: Явное имя «Назад», target≥48dp на реальном Android; переход назад работает.

Изменение: ScreenHeader/ProductDetail labels, 48dp targets; дополнительные имена табов, карточек, селектов и русские zoom controls.

Коммиты: `0cbbfe0`, `ce3ea6d`, `6ec5663`.

Компоненты: `src/components/ScreenHeader.tsx`, `app/product/[id].tsx`, `src/components/BottomTabBar.tsx`, `src/components/SelectField.tsx`.

Проверки: [evidence/native-layout-checks.json](evidence/native-layout-checks.json); [evidence/screenshots/all-products-photo-after.png](evidence/screenshots/all-products-photo-after.png).

Остаточное условие: Это проверка конкретных контролов; полный TalkBack/VoiceOver основной путь отдельно не подтверждён.

## D25 — Adaptive launcher icon обрезает бренд в системной маске Redmi

**FIXED & VERIFIED** · P2 · Android

Исходное поведение: Системная маска увеличивала foreground; концы знака выходили за границу.

Критерий: В реальной системной маске знак целиком, по центру белого квадрата с полями.

Изменение: Expo config plugin:18% inset foreground для adaptive/round drawable, белый фон; исходный знак сохранён.

Коммиты: `5572869`.

Компоненты: `plugins/withLauncherIconPadding.js`, `app.json`.

Проверки: [evidence/screenshots/launcher-icon-before.png](evidence/screenshots/launcher-icon-before.png); [evidence/screenshots/launcher-icon-after.png](evidence/screenshots/launcher-icon-after.png).

Остаточное условие: Снимки сделаны в системном App Info с launcher mask. iOS icon runtime не проверен.

## D26 — Посимвольный ввод телефона дублирует +996 и не даёт очистить префикс

**FIXED & VERIFIED** · P1 · Shared formatter; reproduced Android

Исходное поведение: При ручном вводе полный +996 мог превращаться в повторный префикс; удаление/лишние цифры обрабатывались неверно.

Критерий: Typed/pasted national/international formats сохраняют номер; backspace очищает; excess/foreign digits не становятся чужим валидным номером.

Изменение: Исправлен форматтер. Регистрация с физического телефона сохраняет ровно введённые9 national digits после нормализации, phone_verified_at=NULL.

Коммиты: `76fc34e`.

Компоненты: `src/lib/formatters.ts`, `scripts/tests/phone-input.ts`.

Проверки: [evidence/regression-final.log](evidence/regression-final.log); [evidence/screenshots/native-register-no-code.png](evidence/screenshots/native-register-no-code.png); [evidence/screenshots/native-profile-after-update.png](evidence/screenshots/native-profile-after-update.png).

Остаточное условие: SMS/Telegram phone verification отменены прямым требованием владельца.

## D27 — Первый экран «Все товары» ожидает24 мобильных запросов полного каталога

**FIXED & VERIFIED** · P2 · Shared client/backend; Android observed

Исходное поведение: До первой отображаемой страницы клиент последовательно получал все2365 SKU/24 страницы; поиск использовал полный snapshot.

Критерий: Мобильный список получает одну страницу; глобальные search/sort применяются до пагинации; нет пропусков/дублей; legacy raw order совместим.

Изменение: Пагинация/search/sort выполняются на собственном backend поверх полного validated snapshot. Клиент получает40 товаров за запрос. Общий Bazaar не изменён.

Коммиты: `c9b3992`.

Компоненты: `scripts/server/catalog.ts`, `src/lib/bazaar/client.ts`, `scripts/tests/catalog-gateway.ts`.

Проверки: [evidence/catalog-gateway.json](evidence/catalog-gateway.json); [evidence/screenshots/all-products-photo-after.png](evidence/screenshots/all-products-photo-after.png); [evidence/device-requests.log](evidence/device-requests.log).

Остаточное условие: Production latency/budget не подтверждены replay-каталогом. Это сокращение клиентских запросов, не доказательство production performance gate.

## D28 — System font scale change clips text and resets unfinished form

**FIXED & VERIFIED** · P1 · Android Redmi15 API36 / standalone QA Release

Исходное поведение: At live font scale 1.5 text is drawn in old 1.0 bounds; checkout delivery resets to pickup. Cold start restores text.

Критерий: Physical Android background -> font150 -> resume -> font100: readable controls, same form values, reachable checkout action.

Изменение: System scale is explicitly included in Android Text/TextInput layout size; native second multiplication disabled, no accessibility scale cap. Activity handles fontScale to retain unfinished forms. iOS/web keep native scaling.

Коммиты: `af8c329`, `10180e9`, `7f3d863`.

Компоненты: `src/components/AppText.tsx`, `plugins/withFontScaleChanges.js`, `app.json`.

Проверки: [evidence/native-fontscale.json](evidence/native-fontscale.json); [evidence/native-delivery.json](evidence/native-delivery.json); [evidence/screenshots/font7-after-top.png](evidence/screenshots/font7-after-top.png); [evidence/screenshots/font7-delivery-quote.png](evidence/screenshots/font7-delivery-quote.png).

Остаточное условие: Verified on Redmi15 API36 at100/150%. Full TalkBack/iOS and maximum OEM font settings remain separate release criteria.

## D29 — Android system navigation overlaps checkout action at large font

**FIXED & VERIFIED** · P1 · Android Redmi15 API36 / standalone QA Release

Исходное поведение: At font150 the last checkout button reaches the system navigation bar.

Критерий: Physical font150 checkout button remains above system navigation, scrolls into view and submits correctly.

Изменение: Add bottom safe area on standalone screens; tab screens keep their existing tab-bar spacing.

Коммиты: `9b48758`.

Компоненты: `app/checkout/index.tsx`, `app/product/[id].tsx`, `app/category/[id].tsx`.

Проверки: [evidence/native-fontscale.json](evidence/native-fontscale.json); [evidence/screenshots/font7-delivery-quote.png](evidence/screenshots/font7-delivery-quote.png).

Остаточное условие: Verified final checkout action above Android system navigation at150%; compact/iOS matrix remains separate.

## D30 — Рабочий backend остаётся старым proxy; Telegram webhook отсутствует

**FIXED & VERIFIED** · P1 · Общий backend Android/iOS/web

Исходное поведение: Read-only getWebhookInfo: пустой URL; public /health имеет schema старого proxy; /telegram/webhook404. Заказы не могут пройти рабочий callback.

Критерий: Новый backend развёрнут в согласованной среде, реальный заказ доставлен в отдельную группу; кнопка меняет тот же заказ и статус клиента.

Изменение: Shared website DB, three original accounts preserved, complete migration, actual Railway app-server and admin-web deployed; real order sent and owner Telegram button confirmed the same order.

Коммиты: `80aa4c5`, `2a640b3`, `fa7e957`.

Компоненты: `scripts/app-server.ts`, `scripts/server/orders.ts`, `scripts/server/telegram.ts`, `scripts/check-telegram.ts`, `scripts/tests/telegram-orders.ts`.

Проверки: [evidence/telegram-live-readonly.json](evidence/telegram-live-readonly.json); [evidence/telegram-backend-readonly.json](evidence/telegram-backend-readonly.json); [evidence/telegram-preflight-current.log](evidence/telegram-preflight-current.log); [evidence/production-live-check.json](evidence/production-live-check.json); [evidence/production-migration.json](evidence/production-migration.json).

Остаточное условие: Нет в проверенном пути товара → Telegram → реальная кнопка → тот же заказ в production Android. Мониторинг доставки и другие типы уведомлений оцениваются отдельно.

## D31 — Повтор Telegram callback ошибочно возвращает500 после уже применённого статуса

**FIXED & VERIFIED** · P2 · Общий backend Android/iOS/web

Исходное поведение: Редактирование неизменённого сообщения Telegram выдаёт message is not modified; исключение распространялось после сохранённого статуса.

Критерий: 20 одинаковых callbacks возвращают200, один переход/event, остаток меняется один раз.

Изменение: Идемпотентное unchanged edit распознаётся как успех; последовательность статусов и inventory guards сохранены.

Коммиты: `80aa4c5`, `2a640b3`.

Компоненты: `scripts/app-server.ts`, `scripts/server/orders.ts`, `scripts/server/telegram.ts`, `scripts/check-telegram.ts`, `scripts/tests/telegram-orders.ts`.

Проверки: [evidence/telegram-orders.json](evidence/telegram-orders.json).

Остаточное условие: Реальный Telegram транспорт проверяется отдельно в D30.

## D32 — Telegram worker и callback не ограничены организацией заказа

**FIXED & VERIFIED** · P1 · Общий backend Android/iOS/web

Исходное поведение: Claim выбирал pending заказы без organization_id; callback проверял чат/оператора, но не организацию и исходный message ID.

Критерий: Чужая организация не доставляется и не меняется; чужой message/chat/обычный участник отклонены.

Изменение: Worker scoped по серверному APP_ORGANIZATION_ID, callback связан с organization/chat/message. Новые admin orders endpoints используют тот же server scope и DB роль.

Коммиты: `80aa4c5`, `2a640b3`.

Компоненты: `scripts/app-server.ts`, `scripts/server/orders.ts`, `scripts/server/telegram.ts`, `scripts/check-telegram.ts`, `scripts/tests/telegram-orders.ts`.

Проверки: [evidence/telegram-orders.json](evidence/telegram-orders.json); [evidence/http-security.json](evidence/http-security.json).

Остаточное условие: Реальная конфигурация организации/операторов должна быть подтверждена до deployment.

## D33 — Health показывает готовность после неудачной регистрации webhook

**FIXED & VERIFIED** · P1 · Общий backend Android/iOS/web

Исходное поведение: Health проверял наличие строки URL; ошибку setWebhook startup логировал, но readiness оставался положительным.

Критерий: Registration failure даёт503; готовность только после успешного setWebhook и обязательной DB/org конфигурации.

Изменение: Сохранён результат регистрации, readiness использует его; production требует APP_ORGANIZATION_ID и новую recovery migration.

Коммиты: `80aa4c5`, `2a640b3`.

Компоненты: `scripts/app-server.ts`, `scripts/server/orders.ts`, `scripts/server/telegram.ts`, `scripts/check-telegram.ts`, `scripts/tests/telegram-orders.ts`.

Проверки: [evidence/telegram-orders.json](evidence/telegram-orders.json).

Остаточное условие: После смены внешней конфигурации повторить read-only checker; health не заменяет мониторинг live доставки.

## D34 — Android Photo Picker fails after Activity recreation

**FIXED & VERIFIED** · P1 · Android

Исходное поведение: IllegalStateException: unregistered ActivityResultLauncher; force-stop/cold start restores picker.

Критерий: Cold/warm/recreated Activity can select the known QA image or cancel, without broad library permissions.

Изменение: Pinned Expo core3.0.30 patch binds contracts to the current Activity even when React host omits destroy; publishes current owner before registration. UI normalizes native implementation errors.

Коммиты: `909dfe4`.

Компоненты: `scripts/build/patch-expo-activity.cjs`, `package.json`, `src/components/PhotoAttachment.tsx`, `src/lib/errors/normalizeApiError.ts`.

Проверки: [evidence/native-picker-recreation.json](evidence/native-picker-recreation.json); [evidence/screenshots/picker-after-activity-recreation-before.png](evidence/screenshots/picker-after-activity-recreation-before.png); [evidence/screenshots/picker-after-activity-recreation-after.png](evidence/screenshots/picker-after-activity-recreation-after.png).

Остаточное условие: Cold/recreated Activity opens picker, exact QA file selected and displayed on Redmi v9; native selection cancelled in earlier test. Production media processing is separate D14.

## D35 — Вход теряет исходное назначение; гостевое оформление не предлагает авторизацию

**FIXED & VERIFIED** · P2 · Android, shared client

Исходное поведение: Find-plumber login opens plumber-home; guest checkout shows empty contact form without login action.

Критерий: Guest checkout/login/register preserve cart and destination; service, orders, QR, profile resume; external destinations and auth loops rejected.

Изменение: Explicit allowlist of return destinations, shared auth-layout redirect and role defaults; guest checkout prompt; login/register preserve returnTo.

Коммиты: `54d6011`.

Компоненты: `src/lib/navigation/authDestination.ts`, `app/(auth)/_layout.tsx`, `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `app/checkout/index.tsx`.

Проверки: [evidence/screenshots/guest-checkout-before.png](evidence/screenshots/guest-checkout-before.png); [evidence/screenshots/login-context-before.png](evidence/screenshots/login-context-before.png); [evidence/native-final-pass.json](evidence/native-final-pass.json).

Остаточное условие: Исходный сценарий повторён на Redmi QA standalone v10/v11; после обновления данные сохранены.

## D36 — Android history filters and cursor are silently omitted from requests

**FIXED & VERIFIED** · P1 · Android Hermes URLSearchParams polyfill

Исходное поведение: Selected spent still shows available operations; GET path has no query parameters, native .size is undefined.

Критерий: Physical filtered empty state and next page produce correct status/limit/cursor request; no missing/duplicate journal rows.

Изменение: Serialize mandatory limit, filters and cursor with toString(); remove dependency on unsupported .size.

Коммиты: `06037ef`.

Компоненты: `src/lib/api/program.ts`, `scripts/tests/loyalty-native-query.ts`.

Проверки: [evidence/screenshots/native-history-filter-before.png](evidence/screenshots/native-history-filter-before.png); [evidence/loyalty-native-query.log](evidence/loyalty-native-query.log); [evidence/native-final-pass.json](evidence/native-final-pass.json).

Остаточное условие: Исходный сценарий повторён на Redmi QA standalone v10/v11; после обновления данные сохранены.

## D37 — Android clips the interface after a live display-density change

**FIXED & VERIFIED** · P1 · Android standalone Release

Исходное поведение: Surface uses stale density; content occupies only left portion, text and checkout action clipped. Cold restart restores dimensions.

Критерий: Live density changes both directions keep full-width readable checkout and reachable action; restore original settings.

Изменение: MainActivity retains the current context and refreshes RN pixel metrics; react-native-screens now refreshes its DIP frame even when pixel bounds do not change. Native tests at 320→430dp preserve readable full-width checkout and reachable action.

Коммиты: `73c4a8c`, `5a8fb88`, `188f94f`, `3e977ca`.

Компоненты: `plugins/withFontScaleChanges.js`, `scripts/build/patch-screens-density.cjs`, `package.json`.

Проверки: [evidence/native-density-final.json](evidence/native-density-final.json); [evidence/screenshots/density-after-320-action.png](evidence/screenshots/density-after-320-action.png); [evidence/screenshots/density-after-430-action.png](evidence/screenshots/density-after-430-action.png).

Остаточное условие: No blocker for reproduced density scenario; broader screen matrix remains separate.

## D38 — Мобильный каталог читает прежний Bazaar источник вместо общей базы сайта

**FIXED & VERIFIED** · P1 · Shared backend; Android Release

Исходное поведение: Ни одного из15ID в прежнем snapshot2365SKU. Ошибочно сделан вывод о разных базах; совпадение DATABASE_URL подтверждено без раскрытия credentials. Общая база содержит845 товаров/2147 вариантов.

Критерий: 15ID/названия/цены совпадают с сайтом; картинки загружаются, порядок до пагинации, выбор варианта ведёт к правильной корзине; checkout заново проверяет активность/цену варианта и доверенный остаток филиала.

Изменение: Database gateway default, explicit legacy source only, no silent fallback. Published curated images for15 exact IDs; bounded raster dataURI. Shared recommendation order, variant selector and real variant IDs in cart; fresh DB prices with transaction locks and existing inventory guards.

Коммиты: `a34c135`, `1d98374`, `6c933d7`.

Компоненты: `scripts/app-server.ts`, `scripts/server/catalog.ts`, `scripts/server/catalog/storefront.ts`, `scripts/server/catalog/storefront-query.ts`, `scripts/server/order-trust.ts`, `src/lib/catalog/merchandising.ts`, `src/lib/catalog/selectProductOption.ts`, `src/lib/catalog/imageUrl.ts`, `app/product/[id].tsx`, `scripts/tests/storefront-catalog.ts`.

Проверки: [evidence/storefront-catalog.json](evidence/storefront-catalog.json); [evidence/catalog-merchandising.json](evidence/catalog-merchandising.json); [evidence/native-storefront-catalog.json](evidence/native-storefront-catalog.json); [evidence/featured-images-http.json](evidence/featured-images-http.json); [evidence/screenshots/storefront-all-products-after.png](evidence/screenshots/storefront-all-products-after.png); [evidence/screenshots/storefront-catalog-preview-after.png](evidence/screenshots/storefront-catalog-preview-after.png); [evidence/screenshots/storefront-cart-variant.png](evidence/screenshots/storefront-cart-variant.png).

Остаточное условие: Deployment remains separate: public backend is still old. Read-only production capture, isolated local DB/checkout; no production data modified. Trusted inventory/POS gate unchanged.

## D39 — Нижняя навигация перекрывает zoom карты на компактном Android

**FIXED & VERIFIED** · P1 · Android; shared tab layout

Исходное поведение: Absolute BottomTabBar накрывает минус и attribution; нажатие открывает вкладку Каталог.

Критерий: 320/390/430dp: zoom+/zoom−/pan сохраняют экран Карты; controls и attribution выше навигации, cart CTA доступен.

Изменение: BottomTabBar участвует в обычной раскладке; карта использует измеренную доступную высоту; footer корзины также в потоке, лишние fixed bottom offsets удалены.

Коммиты: `a0433f7`.

Компоненты: `src/components/BottomTabBar.tsx`, `app/(tabs)/maps/index.tsx`, `app/(tabs)/cart/index.tsx`, `src/components/maps/TwoGisMap.tsx`, `src/components/maps/TwoGisMap.web.tsx`.

Проверки: [evidence/screenshots/final-width-320-maps.png](evidence/screenshots/final-width-320-maps.png); [evidence/native-responsive-final.json](evidence/native-responsive-final.json).

Остаточное условие: Android проверен физически при320/390/430dp; iOS отложен владельцем.

## D40 — Partial migrations cannot upgrade the actual production legacy schema

**FIXED & VERIFIED** · P1 · Backend

Исходное поведение: Railway only had app_customers; website only four legacy app tables. Two partial migrations require missing base tables and omit roles/audit/loyalty/service schema.

Критерий: Complete additive upgrade succeeds on the legacy layout, preserves original accounts, does not seed invented rules or touch website tables.

Изменение: Complete schema migration, read-only copy preflight with conflict/digest guards, first-admin CLI and comprehensive startup schema guard. Three production accounts preserved after explicit approval; owner bootstrapped and logged in.

Коммиты: `fa7e957`.

Компоненты: `scripts/db/migrations/20260921-complete-app-schema.sql`, `scripts/db/copy-legacy-accounts.ts`, `scripts/admin/bootstrap-owner.ts`, `scripts/server/db.ts`.

Проверки: [evidence/database-compare-redacted.json](evidence/database-compare-redacted.json); [evidence/deployment-regressions.json](evidence/deployment-regressions.json); [evidence/production-migration.json](evidence/production-migration.json); [evidence/backup-restore-rehearsal.json](evidence/backup-restore-rehearsal.json).

Остаточное условие: Нет в рамках данного критерия.

## D41 — Isolated production build omitted application routes despite successful Gradle build

**FIXED & VERIFIED** · P1 · Android build

Исходное поведение: External expo-router entry through shared node_modules produced951modules without application routes or API configuration; detected before distribution. The invalid APK was not installed or uploaded.

Критерий: Generated bundle includes catalog/checkout/login and actual HTTPS API; signed APK starts the app on Android.

Изменение: Local index.js entry, explicit build root and inspection of actual bundle/routes/API/contact;1472modules now present and signed artifact checks pass. Physical install pending.

Коммиты: `a13a32b`.

Компоненты: `index.js`, `package.json`, `scripts/build/verify-android-bundle.cjs`.

Проверки: [evidence/play-verification.json](evidence/play-verification.json); [evidence/play-release-entry.log](evidence/play-release-entry.log); [evidence/native-production-release.json](evidence/native-production-release.json); [evidence/screenshots/production-all-products.png](evidence/screenshots/production-all-products.png).

Остаточное условие: Fresh production APK installed and actual catalog, owner login and Telegram-confirmed order verified on Redmi. Play internal track remains a separate release gate.
