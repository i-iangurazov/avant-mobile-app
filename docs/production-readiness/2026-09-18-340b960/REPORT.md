# Авантехник — production readiness, 18 сентября 2026

**Google Play: NO-GO. App Store: NO-GO.** Подтверждённая готовность **18%**, покрытие **36%**. Android **21%** (покрытие39%), iOS **21%** (покрытие38%). UI **0%**, лояльность **44%**.

Это доля доказанных критериев по заданным весам, **не вероятность одобрения и не процент завершённости разработки**. Native UI подтверждён0%: фактическая готовность Android/iOS интерфейса не установлена. Нативные оценки выше нуля получены из общих backend/code доказательств, а не из запуска устройств. Отдельные платформенные итоги перенормированы на97% весов направлений, исключая другой магазин; web-only результаты в них не участвуют. Общий итог не равен среднему Android/iOS, поскольку общий реестр включает обе независимые матрицы native и ограниченные web критерии.

## Версия и фактический охват

- Репозиторий проверен: origin `https://github.com/i-iangurazov/avant-mobile-app.git`; ветка main, base commit `340b960bed2af4033637ab0bc35c9c60ccf076e4`. **Dirty working tree**, включая незакоммиченную программу сантехников и новый backend. Только checkout этого SHA не воспроизводит проверенный продукт.
- Точный snapshot: [identity](evidence/identity.json), [SHA256 каждого файла](evidence/source-manifest.json), [исходный git status](evidence/git-status-before.txt). Manifest digest `b6aee174148012d03ff29036ad9c2f175df208e8838559643454d46cafc7225b`.
- App1.0.0, Expo54.0.37 (package range~54.0.35)/RN0.81.5/React19.1.0, Expo Router, React Query, Zustand/AsyncStorage, SecureStore, Node/pg PostgreSQL. kg.avantehnik.app на обеих платформах. Remote release build number неизвестен; изолированный prebuild дал Android versionCode1/iOS CFBundleVersion1. Это не опубликованный build.
- Дата18.09.2026, timezone Asia/Bishkek. [Окружение](evidence/environment.log). Chrome WEB EXPORT390×844, дополнительные320×568/430×932; отдельный PostgreSQL16 на127.0.0.1:55448, API8788. Исходники скопированы без.env; внешние fetch backend запрещены кроме полностью подменённых ответов.
- Снято **75 PNG**, **58 записей состояний** в [галерее](GALLERY.md); карта внутри браузера загружалась из REAL2GIS. Справочник/каталог для UI — MOCK replay50 публичных товаров; Telegram — MOCK. Обработано **36 строк** [матрицы](SCREEN_MATRIX.csv), включая все найденные file routes, inline формы и guards. Непроверенные состояния явно обозначены.
- **Android EMULATOR/PHYSICAL DEVICE: не проверялся. iOS SIMULATOR/PHYSICAL DEVICE: не проверялся.** Java/Android SDK/adb и Xcode/simctl отсутствуют. [Android build attempt](evidence/android-release-attempt.log), [iOS build attempt](evidence/ios-release-attempt.log). Signed AAB/IPA, установок и TestFlight/internal-track результатов нет.
- [Typecheck/lint](evidence/static-checks.log), [JS/assets export3 платформ](evidence/expo-export.log), [prebuild](evidence/native-prebuild.log), [orders integration](evidence/orders-integration.log), [loyalty integration](evidence/loyalty-integration.log) прошли. Это не подтверждение общей готовности.
- Production: только3 безопасных GET без авторизации/записей: health200, products200, categories404; [ответы в обезличенной сводке](evidence/real-api-summary.json). Deployed SHA неизвестен; health schema отличается от нового backend. Нельзя перенести локальные результаты на production интеграцию.

## Почему выпуск заблокирован

**17 подтверждённых находок:** P0=1, P1=8, P2=7, P3=1; release_blocker=true у11. Классификация и условия у каждой записи в [DEFECTS.md](DEFECTS.md), отдельно перечислены риски R01–R07 и вопросы Q01–Q05.

1. **D01 / P0:** регистрация или смена непроверенного телефона на свободный allowlisted номер даёт admin. Подтверждено локальным HTTP200 protected API. Производство не атаковали.
2. **D02 / P1:** после успешного сохранения заказа UI идёт на `/orders/local-…` и показывает404; детали по реальному ID пустые из-за несовместимости envelope data.
3. **D03 / P1:** сервер принимает клиентские цену/количество/произвольный филиал. Менеджер подтверждает заказ вручную; реальное списание денег или резервирование остатков этим аудитом не доказано.
4. **D11 / P1:** журнал бонусов по умолчанию возвращает1 операцию вместо9. Правильная арифметика не делает историю пригодной к сверке.
5. **D06–D08:** нет удаления аккаунта и доступных privacy/program terms. Правила бонусов пока пилотные.
6. **D09/D10:** карта расходится со справочником и обрезает popup; **D12:** проверенная выборка каталога заполнена placeholders; **D16:** необоснованный broad photo permission.

## Двенадцать направлений

Количество статусов в таблице — строки критериев, веса и точные дроби отдельно в [CALCULATION.md](CALCULATION.md). P/F/B/NT/NA = PASS/FAIL/BLOCKED/NOT TESTED/N/A.

|Направление (вес)|Готовность|Покрытие|P/F/B/NT/NA|Главные ограничения/находки|
|---|---:|---:|---|---|
|Визуальное качество UI (20%)|0%|13%|0/2/12/0/0|WEB карта/каталог: D10,D12; все native acceptance BLOCKED|
|UX, навигация и формы (8%)|17%|17%|2/0/7/1/1|Web валидация/guest проверены; native Back/keyboard/deep links не выполнены|
|Основные пользовательские функции (16%)|36%|52%|8/3/10/0/3|Локальный backend проверен; D02,D05,D12; REAL native end-to-end нет|
|Программа лояльности (14%)|44%|53%|10/2/9/2/2|Пилотная арифметика/возвраты/гонка наград PASS; D08,D11; POS и утверждение правил BLOCKED|
|Данные, API и интеграции (8%)|32%|85%|3/4/1/0/1|D03,D04,D09; Telegram real transport BLOCKED; catalog только safe read|
|Стабильность и восстановление (8%)|24%|33%|5/1/8/0/0|JS export и static checks PASS; D04; kill/offline/upgrade native BLOCKED|
|Производительность (5%)|0%|0%|0/0/6/0/0|Нет измерений standalone release на устройствах|
|Безопасность и приватность (8%)|8%|50%|1/6/4/3/0|D01,D06,D07,D17; R03/R05; release bundle/network review не завершены|
|Доступность и локализация (4%)|0%|15%|0/2/6/0/0|D13,D15; native screen readers и font scaling BLOCKED|
|Готовность к Google Play (3%)|0%|33%|0/3/6/0/0|D06,D07,D16; AAB/signing/console BLOCKED|
|Готовность к App Store (3%)|0%|28%|0/2/6/0/0|D06,D07; IPA/SDK/manifests/console BLOCKED|
|Эксплуатация и поддержка релиза (3%)|0%|22%|0/1/4/0/0|Dirty snapshot; monitoring/backup/reviewer evidence BLOCKED|

## Навигация, роли, release функции

Гость: welcome/login/register, каталог/категория/товар, локальная корзина, карта, поиск по фото, о приложении. Покупатель: профиль, заказы, checkout, заявка мастеру, Telegram linking, подача анкеты. Подтверждённый сантехник: профессиональные5tabs (главная/наличие/резервы/заявки/профиль), QR/яркость, бонусы/история/награды, контент/обучение/отзывы. Администратор:5вкладок управления анкетами, заявками, чеками/возвратами, настройками и наградами. Скрытая вкладка не равна серверной защите: guards проверены отдельно.

Pending/rejected/suspended сохраняют покупательские функции; professional endpoints требуют approved. Встроенных SMS OTP, эквайринга/IAP, native push, геолокации, рефералов, избранного и отдельного адресного справочника в актуальном релизе не найдено. Профиль хранит один адрес. Для перечисленных отсутствующих возможностей нет подтверждённого обещания release — отсутствие не объявлено дефектом. Image search disabled по feature flag использует описанный fallback к менеджеру, но камера/WhatsApp не закрыты web тестом. Legacy Bazaar используется только для read-only каталога; заказы/лояльность/заявки работают в новой app DB.

## Материалы для работы

- [Полная матрица экранов/ролей/состояний](SCREEN_MATRIX.csv), [реальная галерея](GALLERY.md), [HTML просмотр](evidence/GALLERY.html), [разбор UI/селектов/карты](VISUAL_REVIEW.md).
- [Реестр дефектов с приёмкой](DEFECTS.md), [машинный JSON](DEFECTS.json), [лояльность и конкретные расчёты](LOYALTY.md).
- [Google Play и App Store checklists](STORE_CHECKLISTS.md), [roadmap с зависимостями/ролями/S–M–L](ROADMAP.md), [точные препятствия и устройства](BLOCKERS.md).
- [147 критериев](CRITERIA.csv), [формулы/числители/знаменатели](CALCULATION.md), [SCORES.json](SCORES.json), [пересчёт Python](calculate.py), [история scope](SCOPE.md).

Запуск пересчёта: `python3 docs/production-readiness/2026-09-18-340b960/calculate.py`. Readiness=100×PASS_weight/applicable_weight; coverage=100×(PASS+FAIL)_weight/applicable_weight; итог — взвешенное среднее12направлений. N/A исключены только с объяснением; BLOCKED/NT баллов не дают. Кодовая гипотеза не засчитывается за runtime PASS. Новые результаты после исправлений сохранять с новым commit/build и повторными доказательствами.

## Границы вывода и решение

Полный физический mobile аудит не выполнен из-за конкретных недостающих инструментов/устройств/доступов. Галерея содержит реальные web экраны и начало/конец длинных ScrollView; не каждый промежуточный участок длинного каталога, не все50товаров, не все состояния всех ролей просмотрены. Не выполнены нагрузочные production проверки, реальные SMS/Telegram/платежи/POS, native permission dialogs, physical QR scan, VoiceOver/TalkBack, CPU/RAM/ANR/cold start. Поэтому высокий процент после локальных исправлений сам по себе не позволит GO.

Продуктовый код и чужие изменения сохранены. Добавлены только материалы аудита; prebuild и средства воспроизведения работали в изолированной копии. Ничего не отправлялось в магазины или другим людям. GO возможен только после закрытия blockers и полного обязательного release покрытия, ≥95% общего, ≥90% каждого направления, UI≥95%; остаточный риск пока не принят. Неизвестные дефекты могут оставаться.

Контроль сохранности: [194 исходных файла совпали с исходным SHA256 manifest](evidence/source-integrity.json). Инструкции воспроизведения: [TEST_RUN.md](TEST_RUN.md).
