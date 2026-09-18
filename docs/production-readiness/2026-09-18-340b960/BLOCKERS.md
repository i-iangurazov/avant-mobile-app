# Недоступные проверки и точный способ закрытия

|ID|Что заблокировано|Конкретное препятствие|Как закрыть / результат|
|---|---|---|---|
|B01|Android standalone release|Нет Java Runtime, Android SDK/adb; Gradle остановился до сборки|JDK, SDK36/build tools, release keystore/EAS build доступа, signed AAB с commit/build; затем install и тесты. Не требуются production записи.|
|B02|iOS standalone release|Нет Xcode/simctl; активен только CommandLineTools|Mac с Xcode26+ и подходящим SDK, provisioning/team, подписанный IPA/TestFlight build; зафиксировать archive settings.|
|B03|Физические устройства/перфоманс|Ни одного Android/iPhone не предоставлено и не подключено|Ниже release-матрица; устройства можно предоставить QA, не обязательно этой машине. Нужны логи/видео/снимки с build ID.|
|B04|Store-console требования|Нет Google Play Console/App Store Connect|Read-only evidence о developer account type/date, production gate, signing, договорах, privacy/ratings/app access/listing; никаких загрузок этим аудитом не разрешено.|
|B05|Утверждение лояльности|Seed значения прямо названы pilot|Владелец утверждает документ: ставки, уровни, база/скидки, rounding, pending, exclusions/promos, spend/return/debt, retention/consents, privileges. Версия/дата обязательны.|
|B06|POS/1C end-to-end|Нет staging и подписанного M2M контракта|POS owner даёт test endpoint/credentials вне отчёта и события purchase/return/duplicate/out-of-order; результат — сверка чек→ledger→оба устройства.|
|B07|Telegram/WhatsApp/support|Нет выделенного тестового bot/chat/reviewer recovery процесса; внешние сообщения не отправлялись|Staging bot+test chat+webhook secret и разрешение на sandbox сообщения; проверить delivery/retry/link/unlink; support owner демонстрирует reset без раскрытия пароля.|
|B08|Production full API|Новый backend commit не идентифицирован; GET health имеет другую схему|Staging с deployed SHA текущего API, тестовые customer/plumber/admin; seed каталог/остатки, ошибки HTTP, безопасные наборы гонок.|
|B09|Privacy/deletion/фото|Нет опубликованных privacy/terms/deletion URL и upload policy|Реальные документы+retention mapping; test аккаунт для удаления; storage test bucket, срок/лимиты/доступ фото.|
|B10|Эксплуатация|Monitoring, symbol upload, backup/restore и rollout process вне доступа|Build с crash SDK/config, тестовая диагностика без PII, restore в отдельной БД, runbook с ответственными; rollback API совместимости, stop rollout, hotfix процесс.|
|B11|Upgrade/API compatibility|Нет предыдущего опубликованного build и support window|Предыдущие AAB/IPA и схема пользовательских данных; если это первая публикация — доказать, отметить upgrade N/A с причиной, всё равно clean install обязательна.|
|B12|Доступность/deep links/system dialogs|Web не заменяет TalkBack/VoiceOver, keyboard, native share/permissions|Standalone build на устройствах; отказ/limited photos/яркость, font scaling200%, screen reader focus, Android Back/iOS swipe, avantehnik deep links, expired401/relaunch.|

## Матрица устройств для обязательного следующего прогона

Это **план покрытия**, не список выполненных прогонов. Generated minimum: Android API24 (RN versions catalog), iOS15.1 (prebuild pbxproj). В окончательном AAB/IPA перепроверить effective minimum. Актуальные поколения на дату аудита: [Android17](https://developer.android.com/about/versions/17/get) и [iOS27, выпущена14.09.2026](https://support.apple.com/en-us/100100). Target API36 и минимально требуемый upload SDK26 — другие понятия.

|Приоритет|Устройство/система|Размер/класс|Обязательные проверки|Факт|
|---|---|---|---|---|
|1|Физический бюджетный/средний Android, поддерживаемая стабильная ОС|≈360dp, ограниченная RAM|каталог→корзина→заказ, QR/камера/WebView, слабая сеть, CPU/RAM/ANR, TalkBack|BLOCKED|
|1|Физический iPhone сiOS27|≈390–402pt|покупатель/мастер, safe area, keyboard, VoiceOver, фон/kill,permissions|BLOCKED|
|2|Android7/API24 emulator/device|компактный320–360dp|минимальная совместимость, TLS/fonts/layout/native dependencies|BLOCKED|
|2|Android17 emulator/physical|большой≈430dp,16KB image отдельно|edge-to-edge, Back, large font,16KB.so, ресайз если ОС навязывает|BLOCKED|
|2|iOS15.1 simulator/device|компактный iPhone SE class|минимальный deployment target, длинные формы/клавиатура, memory|BLOCKED|
|2|iOS27 большой iPhone|≈430–440pt|карта, шапки/таббар, список/QR, длинные строки|BLOCKED|
|Выполнено вспомогательно|Chrome/macOS web export|320×568,390×844,430×932|галерея, локальный checkout, fixtures, map widget, form states|WEB ONLY|

Планшеты и landscape не заявлены: app.json supportsTablet=false, orientation=portrait. Это не освобождает от проверки реальной политики resize больших Android устройств. Дополнительных языков не требуется — реализация русская/KGS/Бишкек. Системная dark mode проверена только в Chrome: light theme сохраняется; native prebuild предупреждает об отсутствии expo-system-ui.

## Измерения, которых нет

Cold/warm start, time-to-content, scroll jank, RAM, CPU, battery, crash-free/ANR — **не измерены**. Три GET имели времена1651/2090/677ms по одному запросу: это диагностика доступности, не p95 и не mobile performance. Предлагаемые, ещё не утверждённые бюджеты: usable cold start≤3с на среднем устройстве, локальный feedback≤100мс, поиск после debounce≤1.5с на согласованной сети;≥10 запусков каждого типа с median/min/max, без объявления достоверного p95 по малой выборке. Порог памяти/ANR согласовать по профилю устройств, а не придумать универсальное число.
