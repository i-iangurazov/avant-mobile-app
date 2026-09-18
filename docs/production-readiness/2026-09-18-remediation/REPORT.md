# Авантехник — результат исправлений, 18 сентября 2026

**Google Play — NO-GO. App Store — NO-GO.** В изолированной ветке исправлены и повторно проверены8 из17 исходных дефектов, включая4 из11 исходных блокеров. Найдены4 новых дефекта (D18–D21), все4 исправлены и проверены. Осталось9 исходных дефектов:7 BLOCKED и2 IMPLEMENTED, NOT VERIFIED. Код в production не развёрнут.

## Реальная база и изменения

Исходный main остаётся на `340b960bed2af4033637ab0bc35c9c60ccf076e4`. SHA в названии аудита не описывал весь dirty tree: `c88450a` сохраняет исходные незакоммиченные продуктовые изменения и файлы аудита как отдельный snapshot, а не исправление. Изоляция — ветка `fix/production-readiness-20260918`, постоянный worktree `.worktrees/production-readiness` внутри исходного проекта. Продуктовый source последней сборки: **5b8ea84**; test/reproduction commit: **0d8e474**. [Список коммитов](COMMITS.md).

128 файлов baseline и194 исходных продуктовых файлов сверены по SHA-256; оригинальный каталог не перезаписан. Исходный калькулятор в временной копии дал точное совпадение с исходными SCORES:18% готовности/36% покрытия. [Доказательство сохранности](evidence/preservation.json). Применимых AGENTS.md при исходном поиске не обнаружено.

Изменён **один репозиторий**, содержащий мобильный клиент, Node backend, PostgreSQL schema/migration и tests. Исходники общего Bazaar/POS backend не предоставлены, его совместимость и развёртывание изменений не заявлены. Порядок внедрения: review контрактов/привилегий → backup+restore rehearsal → additive migration → approved documents/inventory/providers → staging backend → согласованный клиент → devices/store evidence. Auth v2 несовместим со старыми stateless tokens; это требует согласованного обновления клиентов. [Preflight, миграция, incident review и rollback](DEPLOYMENT.md).

## Закрытие реестра

|Группа|FIXED & VERIFIED|IMPLEMENTED, NOT VERIFIED|BLOCKED|OPEN|
|---|---:|---:|---:|---:|
|17 исходных дефектов|8|2|7|0|
|Из них11 release blockers|4|1|6|0|
|4 новых дефекта|4|0|0|0|

Закрыты D01,D02,D03,D04,D05,D11,D13,D15. BLOCKED: D06,D07,D08,D09,D10,D12,D14. IMPLEMENTED, NOT VERIFIED: D16,D17. Незакрытые release blockers: D06,D07,D08,D09,D10,D12,D16. Статус BLOCKED не означает отсутствие кода: D06, например, прошёл реальное удаление из тестовой БД и очистку web-сессии, но не полную исходную приёмку с retention/external providers/native.

[CLOSURE.md](CLOSURE.md) и [CLOSURE.json](CLOSURE.json) сохраняют все исходные IDs, actual/acceptance, release flags и связывают каждое изменение с файлами, коммитами, повторными проверками и препятствием. Расхождения с исходными17/11 отсутствуют. R01–R07 и Q01–Q05 также разобраны в [BLOCKERS](BLOCKERS.md), не потеряны за пределами17 IDs.

## Что изменено

- **Безопасность.** Телефон/allowlist не назначает admin. Сервер проверяет verified account и DB role, выдача/отзыв роли аудируются. Bound OTP имеет TTL/attempt/send limits, привязан к действию/номеру/аккаунту и одноразовый; проверены подмена роли/номера, неверный/истёкший/повторный код, legacy privileged token/refresh и все22 admin method/path. Access15min, refresh rotation, logout/reset/phone change revocation, cache purge при401/смене аккаунта. Универсального OTP и production bypass нет. Старые production сессии/администраторы автоматически не отзывались/не удалялись; incident review остаётся EX-04.
- **Заказы и корзина.** Серверные offers/branches определяют организацию, филиал, цену, остаток и сумму; неизвестные IDs, client totals/discounts, неправильные quantity и stale данные отвергаются. Quote перед подтверждением; транзакционные holds и идемпотентность по account/key/hash. Клиент сохраняет попытку и восстанавливает фактический серверный ID после потери ответа. Cart mutations сериализованы; подтверждённое содержимое удаляется один раз, новые добавления сохраняются.
- **Бонусы.** Исправлен default limit1, cursor pagination с точным timestamp+ID и5 UI фильтрами.137 операций загружены без пропусков/дубликатов в5 страницах, баланс сверен с журналом. Receipt/return/reward/cancel операции сериализованы; replay reward с другим rewardId теперь409. Начисление, доступность, списание, полный/частичный возврат, повторы и конкурентный возврат/списание проверены. Коммерческие ставки/округление сохранены как существующая логика, их утверждение отдельно BLOCKED. Production ledger не изменён.
- **Аккаунт и документы.** Добавлены password+OTP удаление UI/API/web, versioned deletion confirmation, hard deletion связанных app данных и отзыв доступа, rollback при отказе media adapter; другие пользователи/операции сохраняются. Гостевые и authenticated privacy/terms/loyalty/deletion ссылки и сохранение версий согласия. Тестовые тексты явно помечены; [проекты и точные вопросы](drafts/POLICIES.md) не опубликованы как действующие условия.
- **UI.** Единые селекты с поиском/scroll/empty/close/aria states, аккуратные buttons/inputs и readable contrast; исправлены статусы, переносы и русские формы, сокращены пустые изображения и добавлен error fallback. Исправлены5 из6 ошибочных firm IDs, выбранный филиал вынесен в карточку, сохранены атрибуция и внешний fallback. D10 остаётся: iframe popup всё ещё обрезается. D12 остаётся: в реальном sample50 SKU по-прежнему нет достаточного контента. Picker/upload контракт внедрён, реальный provider и runtime разрешения ещё не проверены.
- **Сборка и эксплуатация.** Удалены ненужные media/storage/audio/overlay/settings/biometric/vibrate permissions из фактического Android manifest, установлен expo-system-ui. Исправлены advisory dependencies (audit0) и Metro совместимость. Убрано молчаливое подключение к production при пропущенном API URL. Есть явная миграция, local backup/restore, CI и health с проверкой БД. Remote CI/production операции не выполнялись.

Новые дефекты: D18 — конфликт reward replay; D19 — отсутствующие web accessibility states; D20 — потеря количества при параллельном add в корзину; D21 — неявный production fallback API. Для каждого сохранены воспроизведение/границы доказательств в реестре.

## Проверки и артефакты

- PASS:135 regression checks,74 HTTP checks,25 web flow checks, исходные orders/loyalty suites, typecheck/lint, audit0, export web/Android/iOS. Backup/restore34 таблиц и миграция baseline→new дважды. Два локальных API process+restart подтвердили общий rate limit. [Полный TEST_RUN](TEST_RUN.md).
- [Галерея до/после](GALLERY.html):63 состояния,99 индексированных PNG,390×844/320×568/430×932,0 JavaScript runtime exceptions в gallery. [Парные ссылки](GALLERY.md), [матрица36 исходных+3 новых экранов](SCREEN_MATRIX.csv). Это web export с локальным API и изолированными providers, не screenshots нативных релизов.
- Android standalone release APK/AAB собраны: [APK](../../../artifacts/remediation-20260918/android/app-release.apk), [AAB](../../../artifacts/remediation-20260918/android/app-release.aab), [hash/точный source](evidence/android-artifacts.json), [build log](evidence/android-release-minimal.log). Arm64-v8a, target36/min24;17 ELF библиотек и ZIP/AAB статически проверены на16KB alignment. **Тестовая подпись Android Debug и inert API URL. Не для store upload. Не устанавливались на устройство.**
- iOS prebuild/Hermes export прошли, но Xcode/Pods/signing отсутствуют: **IPA/xcarchive нет**. Физические устройства обеих платформ, свежая установка/upgrade, native permission/offline/background/performance, runtime16KB и screen readers не проверены. [Команды и owner smoke](NATIVE_OWNER_CHECK.md). Expo Go/web не засчитаны вместо release.

## Готовность и покрытие

Формулы/веса неизменны. В ячейках готовность / покрытие, %. На прежнем охвате результат35/41; основной результат с явно добавленными внешними gates —33/40. Все147 исходных критериев сохранены; CORE-NA3 стал применимым, добавлены4 BLOCKED строки EX-01..04. Итого151 критерий:55 PASS,9 FAIL,81 BLOCKED,6 N/A. Непроверенные обязательные пункты остались в знаменателе.

|Направление|Вес|Baseline|После, текущий охват|
|---|---:|---:|---:|
|Визуальное качество UI|20|0 / 13|0 / 13|
|UX, навигация и формы|8|17 / 17|39 / 39|
|Основные пользовательские функции|16|36 / 52|46 / 50|
|Программа лояльности|14|44 / 53|58 / 62|
|Данные, API и интеграции|8|32 / 85|74 / 74|
|Стабильность и восстановление|8|24 / 33|33 / 33|
|Производительность|5|0 / 0|0 / 0|
|Безопасность и приватность|8|8 / 50|55 / 62|
|Доступность и локализация|4|0 / 15|15 / 15|
|Готовность к Google Play|3|0 / 33|21 / 46|
|Готовность к App Store|3|0 / 28|0 / 28|
|Эксплуатация и поддержка релиза|3|0 / 22|22 / 22|

|Платформа/охват|Baseline|После, тот же охват|После, текущий охват|
|---|---:|---:|---:|
|Общий|18 / 36|35 / 41|33 / 40|
|Android|21 / 39|41 / 45|39 / 43|
|iOS|21 / 38|41 / 44|39 / 42|

Повышение Android/iOS происходит главным образом за счёт проверенных SHARED backend/code критериев. Это **не подтверждённый процент испытаний на устройствах**: physical criteria не закрыты. Нулевой UI readiness сохранён, потому что его положительные критерии требуют physical release evidence. [Все12 направлений по каждой платформе и причины](COMPARISON.md), [формулы/веса](CALCULATION.md), [изменение охвата](SCOPE.md), [первичные строки](CRITERIA.csv).

## Что требуется до подачи

**Google Play: NO-GO. App Store: NO-GO.** [Checklist](STORE_CHECKLISTS.md) обновлён по официальным страницам на18.09.2026; консоли/подача недоступны и не выполнялись.

1. Утвердить правила бонусов, privacy/terms/deletion/retention, границу quote/reservation/заказа, доставку и UGC moderation/report/block процесс.
2. Предоставить staging/контракт общего Bazaar/POS, trusted inventory synchronization, реальные SMS/media adapters, map key/координаты и корректный каталог; подтвердить филиалы/контакты.
3. Проверить production администраторов и legacy sessions, согласовать безопасный auth v2 rollout для всех клиентов. Массовые отзывы/удаления — только по отдельному проверенному плану.
4. Дать Android signing/Play account и Apple Team/Xcode26+/Pods/provisioning; пересобрать с одобренным staging URL.
5. Пройти всю физическую release матрицу на Android/iPhone, включая16KB, установку/upgrade, покупку/бонусы/удаление/permissions/offline/background/accessibility.
6. Подготовить публичные privacy/support/deletion URLs, Data safety/App Privacy, store screenshots и reviewer customer+approved plumber с рабочей проверкой номера.

Подробные точные вопросы и необходимые доступы: [OWNER_ACTIONS](OWNER_ACTIONS.md). Доступные локальные исправления и проверки завершены; оставшиеся препятствия не считаются готовностью.
