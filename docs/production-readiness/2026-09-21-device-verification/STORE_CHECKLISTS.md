# Store checklist — 21 сентября 2026

**Google Play: NO-GO. App Store: отложен владельцем, вне текущего выпуска.** Прежний iOS NO-GO не изменён на GO; его условия сохранены для будущего этапа. Проверены актуальные официальные требования; Play Console не изменялась. Production API/admin-web внедрены по разрешению владельца; подписанные APK/AAB собраны, APK проверен на Redmi. Internal track ещё не пройден.

|Условие|Google Play|App Store|
|---|---|---|
|SDK|PASS в production APK/AAB: target 36 соответствует [требованию API 36 с31.08.2026](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)|BLOCKED: нужен [Xcode26+ / iOS26 SDK с28.04.2026](https://developer.apple.com/news/upcoming-requirements/); установлен только Command Line Tools|
|Сборка/подпись/доставка|Production APK/AAB подписаны upload key; APK с HTTPS API установлен на Redmi. Play App Signing/internal track остаются непроверенными.|Нет archive/IPA/provisioning/TestFlight установки; USB iPhone недостаточно|
|16 KB|ZIP/ELF alignment проверен; [runtime на16 KB](https://developer.android.com/guide/practices/page-sizes) и store-generated split APK ещё BLOCKED; Redmi4 KB|N/A|
|Privacy и данные|BLOCKED: утверждённая публичная privacy и [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) по фактическим данным/SDK/провайдерам отсутствуют|BLOCKED: утверждённая privacy/App Privacy и проверка archive privacy manifests/required reasons отсутствуют|
|Удаление|API/UI реализованы, локальное удаление проверено. [Рабочий web-путь и retention disclosure](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) требуют утверждённых текстов и доступного HTTPS URL|Удаление должно быть доступно внутри приложения; iOS release-путь и действующие тексты пока не проверены, [Review Guidelines5.1.1](https://developer.apple.com/app-store/review/guidelines/)|
|Разрешения|Финальный APK не содержит broad media/storage/overlay/audio/biometric permissions; выбор собственного QA-файла и отказ камеры проверены на Redmi; полный release network/SDK inventory ещё не завершён|Camera/photo usage strings есть; фактические prompts/limited photo library/entitlements требуют iOS release|
|Review access|Рабочий HTTPS backend внедрён; review customer+approved plumber и инструкции ещё нужны|То же; приложение должно быть полностью доступно review, [Guidelines2.1](https://developer.apple.com/app-store/review/guidelines/)|
|Вход/восстановление|SMS/Telegram verification отменены владельцем. Нужны утверждённый support identity process и безопасная передача одноразовой ссылки; не OTP bypass|То же; локальный support fixture не является работающей службой поддержки|
|Контент/бонусы|BLOCKED: утверждённые loyalty/legal правила, POS/media, реальные фото/описания при принятом критерии владельца|То же|
|UGC|Нужно подтвердить применимость и пути жалобы/блокировки/модерации. Административное скрытие само по себе gate не закрывает|[Guidelines1.2](https://developer.apple.com/app-store/review/guidelines/): те же применимые требования; решение владельца и evidence отсутствуют|
|Listing/release assets|Иконка исправлена и проверена на Redmi; итоговые store screenshots, описание, возраст/аудитория/ads/content forms не заполнены|Метаданные, native screenshots и обновлённый возрастной опрос не заполнены; [новые возрастные категории](https://developer.apple.com/news/upcoming-requirements/) действуют с31.01.2026|
|Developer testing gate|Тип/дата аккаунта не известны. Для personal accounts после13.11.2023 нужны [12 тестировщиков14 непрерывных дней](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), если условие применимо|Apple Developer membership, договоры/доступы/Team не подтверждены; при EU распространении проверить trader status|
|Эксплуатация|Backup обеих productionБД и restore rehearsal выполнены. Crashmonitoring/supportprocess/incidentreview остаются непроверенными|То же|

Новые disclosure для review: ручные recovery contact/review notes, Leaflet CDN/OSM tiles, Telegram links/outbox, media processing/storage и POS. Указывать только реально используемые провайдеры. Автоматический фото-поиск пока не подключён; нельзя описывать его в listing как работающий.

Старые требования подключить SMS больше не применимы после прямого изменения задания владельцем. Они заменены обязательной проверкой ручного восстановления EX-05. Остальные критерии/веса не исключаются для повышения результата.

21.09 повторно сверены официальные страницы target API, удаления, testing gate и16KB. Console/testing eligibility из публичной документации не выводятся.
