# Магазины — повторная сверка18.09.2026

**Google Play: NO-GO. App Store: NO-GO.** Полный [checklist предыдущего этапа](../2026-09-18-remediation/STORE_CHECKLISTS.md) остаётся применимым. Официальные Google/Apple страницы открыты повторно сегодня. Консоли не подключались.

|Обязательное условие|Google Play|App Store|
|---|---|---|
|Самостоятельный актуальный release, подпись, установка|BLOCKED: прошлый engineering APK/AAB имеет test key/inert host и не содержит новые изменения|BLOCKED: IPA отсутствует; нет Xcode/подписей|
|Privacy/Data safety/App Privacy, deletion|BLOCKED: нет утверждённых текстов/retention/processors и публичного production web deletion URL|BLOCKED: утверждённая privacy и native deletion не подтверждены|
|Карта|Web popup исправлен; runtime native ещё BLOCKED|Web popup исправлен; runtime native ещё BLOCKED|
|Review accounts/backend/SMS|BLOCKED: staging/SMS и review credentials не предоставлены|BLOCKED: staging/SMS и review credentials не предоставлены|
|Бонусы|Повторы исправлены и локально проверены; правила/POS ещё BLOCKED|То же|
|Listing, screenshots, permissions, accessibility|Нужны release screenshots/консольные анкеты/физические проверки|То же; archive privacy manifest/entitlements не проверены|
|UGC baseline Q05|Применимость/report/block/moderator требуют решения и доказательств|Не закрыто наличие пользовательского report/block пути; admin hide не доказывает полный gate|

Изменения требуют учесть новые сетевые обращения Leaflet CDN/OSM и хранение ключа восстановления награды в фактическом описании данных. [Google Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) заполняется по поведению выпуска. [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) требуют соответствующего пути удаления; локальная успешная проверка не означает публикацию web URL. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878) сверяются с новым AAB перед загрузкой; исходная конфигурация target36 сохранена.

[Apple Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) требуют работоспособного приложения, доступа для review и выполнения применимых privacy/UGC условий. Проверка браузера не закрывает native/TestFlight. Остальные SDK/16KB/testing-account условия, официальные ссылки и команды владельцу приведены в полном предыдущем checklist и [NATIVE_OWNER_CHECK](../2026-09-18-remediation/NATIVE_OWNER_CHECK.md).
