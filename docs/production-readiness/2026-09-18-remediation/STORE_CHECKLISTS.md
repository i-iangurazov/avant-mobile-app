# Проверка магазинов — 18 сентября 2026

**Google Play: NO-GO. App Store: NO-GO.** Исправление кода не заменяет утверждённые документы, работающие внешние сервисы, подпись и проверку на устройствах. Консоли магазинов недоступны; загрузок/публикаций не было. Ниже требования перепроверены по официальным страницам на дату работы.

## Google Play

|Требование|Результат и оставшееся действие|
|---|---|
|[Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en): для обычных новых приложений/обновлений с31.08.2026 API36+|Фактический AAB target36/min24 проверяется bundletool; extension не предполагается.|
|[AAB и настройка приложения](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)|Самостоятельный engineering release собран, arm64-v8a. Подпись Android Debug. Нужны upload key/Play App Signing, подтверждённый versionCode и internal-track installation.|
|[16KB](https://developer.android.com/guide/practices/page-sizes)|17 ELF библиотек имеют PT_LOAD alignment≥16KB; APK zipalign -P16 и AAB PAGE_ALIGNMENT_16K. Runtime на16KB устройстве/эмуляторе не выполнен. Другие ABI не проверены.|
|[User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)|Data safety и опубликованная privacy policy BLOCKED: нет утверждённых retention/processor/transfer сведений и release network trace. Учесть телефон, адрес, заказы, бонусы, фото, SMS, Telegram, POS, media provider.|
|[Удаление аккаунта](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)|UI/API и web route `/delete-account` реализованы, web + тестовая БД проверены. Нужны утверждённая deletion policy, публичный HTTPS web URL без установки приложения, реальные SMS/media deletion и native испытание.|
|[Разрешения фото](https://support.google.com/googleplay/android-developer/answer/16935362?hl=en)|Используется одиночный системный picker; broad media/storage, overlay, settings, audio исключены. Итоговые разрешения — в evidence/android-permissions.txt. Выбор, отмена и отказ camera/Photos на устройствах остаются обязательны.|
|[Testing gate](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)|Для подпадающего personal account:12 testers непрерывно14д до production-access заявки. Тип/дата аккаунта неизвестны; проверяет владелец. Internal track не заменяет этот gate.|
|Listing/app access/rating/audience/ads|Нужны консольные анкеты, support URL, реальные release screenshots, подтверждённые customer/plumber credentials и доступный способ проверки телефонных действий. Web-галерея исправлений не объявляется store screenshots.|
|[Физические товары](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)|Заказ/резерв не списывает деньги; IAP/payment sandbox для текущей модели N/A. Будущий платёжный сценарий требует отдельной проверки.|

## App Store

|Требование|Результат и оставшееся действие|
|---|---|
|[SDK minimum](https://developer.apple.com/news/upcoming-requirements/): с28.04.2026 Xcode26+/iOS26 SDK+|BLOCKED: только Command Line Tools; Xcode/Pods/подпись отсутствуют. iOS Hermes export и prebuild прошли, IPA/архив не собраны.|
|Signing, provisioning, entitlements, TestFlight|Bundle ID kg.avantehnik.app; нужны team, сертификаты/profiles, согласованный build number и установка архива.|
|[Privacy manifests / SDK](https://developer.apple.com/support/third-party-SDK-requirements/)|Проверить агрегированный privacy report и required-reason APIs в реальном архиве. Наличие файлов в node_modules не подтверждает архив.|
|[Privacy и удаление,5.1](https://developer.apple.com/app-store/review/guidelines/)|Функции реализованы частично подтверждённым способом; утверждённые тексты, фактические передачи/хранение и native deletion остаются BLOCKED.|
|[Работоспособность/review access,2.1](https://developer.apple.com/app-store/review/guidelines/)|Заказ восстановлен в web + local API. Нужны real staging/release smoke, customer и approved plumber без ожидания ручного approve. OTP не обходить универсальным кодом.|
|[Отзывы/UGC,1.2](https://developer.apple.com/app-store/review/guidelines/)|У baseline есть Q05: moderation backend присутствует, пользовательский report/block путь и ответственность оператора не подтверждены. Владелец должен согласовать применимость/модерацию и закрыть этот gate до подачи. Наличие admin hide API не считается полным доказательством.|
|Возраст/метаданные/support|Актуальная анкета рейтинга по обновлению31.01.2026, контакты поддержки и screenshots с release-устройств; EU trader status при соответствующей географии. Консольные данные не подтверждены.|
|[ATT/social login/physical goods](https://developer.apple.com/app-store/review/guidelines/)|Tracking SDK и сторонний primary login по коду не найдены; Telegram используется для уведомлений. Не добавлять ATT/Apple login автоматически, подтвердить network/SDK inventory архива. Физические товары не требуют IAP автоматически.|

Официальные ссылки не заменяют оценку конкретной консоли. Store policy страницы прочитаны заново; baseline checklist сохранён без изменений. Инженерные Android artifacts не предназначены для отправки: тестовая подпись и намеренно неработающий API host исключают использование реальных данных.
