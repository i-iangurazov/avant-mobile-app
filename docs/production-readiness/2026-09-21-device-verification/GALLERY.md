# Скриншоты до/после и финальные состояния

Сняты на реальном Redmi15/StandaloneRelease, кроме явно обозначенных web. Сравнимые пары используют тот же аппарат и одинаковые состояния.

|Изменение|До|После|
|---|---|---|
|Launchericon/OEMmask|[До](evidence/screenshots/launcher-icon-before.png)|[После](evidence/screenshots/launcher-icon-after.png)|
|Реальнаяфотография|[До](evidence/screenshots/real-product-photo-before.png)|[После](evidence/screenshots/real-product-photo-after.png)|
|150%шрифт/нижняякнопка|[До](evidence/screenshots/checkout-large-font-cold-top.png)|[После](evidence/screenshots/font7-delivery-quote.png)|

Font before/after показывает прежнюю ошибку при том же150%масштабе; положение scroll отличается, потому что итоговая кнопка теперь доступна. Внутриfinalfont7 есть последовательность100→150→100 для сравнения layout.

|Экран|Доказательство|
|---|---|
|all-products-known-photo-before|[Открыть](evidence/screenshots/all-products-known-photo-before.png)|
|all-products-photo-after|[Открыть](evidence/screenshots/all-products-photo-after.png)|
|all-products-photo-before-loaded|[Открыть](evidence/screenshots/all-products-photo-before-loaded.png)|
|all-products-placeholder-after|[Открыть](evidence/screenshots/all-products-placeholder-after.png)|
|camera-denied-return|[Открыть](evidence/screenshots/camera-denied-return.png)|
|camera-denied|[Открыть](evidence/screenshots/camera-denied.png)|
|catalog-cards-before|[Открыть](evidence/screenshots/catalog-cards-before.png)|
|checkout-before|[Открыть](evidence/screenshots/checkout-before.png)|
|checkout-final-lost-response|[Открыть](evidence/screenshots/checkout-final-lost-response.png)|
|checkout-large-font-cold-top|[Открыть](evidence/screenshots/checkout-large-font-cold-top.png)|
|checkout-large-font-dark-top|[Открыть](evidence/screenshots/checkout-large-font-dark-top.png)|
|checkout-lost-response|[Открыть](evidence/screenshots/checkout-lost-response.png)|
|checkout-reopened-pending|[Открыть](evidence/screenshots/checkout-reopened-pending.png)|
|checkout-server-quote|[Открыть](evidence/screenshots/checkout-server-quote.png)|
|final-cart-empty|[Открыть](evidence/screenshots/final-cart-empty.png)|
|final-delivery-reopened|[Открыть](evidence/screenshots/final-delivery-reopened.png)|
|final-order-history|[Открыть](evidence/screenshots/final-order-history.png)|
|font7-after-bottom|[Открыть](evidence/screenshots/font7-after-bottom.png)|
|font7-after-top|[Открыть](evidence/screenshots/font7-after-top.png)|
|font7-before|[Открыть](evidence/screenshots/font7-before.png)|
|font7-delivery-confirmed|[Открыть](evidence/screenshots/font7-delivery-confirmed.png)|
|font7-delivery-detail|[Открыть](evidence/screenshots/font7-delivery-detail.png)|
|font7-delivery-quote|[Открыть](evidence/screenshots/font7-delivery-quote.png)|
|font7-restored|[Открыть](evidence/screenshots/font7-restored.png)|
|font7-scroll-action|[Открыть](evidence/screenshots/font7-scroll-action.png)|
|launcher-icon-after|[Открыть](evidence/screenshots/launcher-icon-after.png)|
|launcher-icon-before|[Открыть](evidence/screenshots/launcher-icon-before.png)|
|map-network-fallback|[Открыть](evidence/screenshots/map-network-fallback.png)|
|map-online-after-retry|[Открыть](evidence/screenshots/map-online-after-retry.png)|
|map-popup-after|[Открыть](evidence/screenshots/map-popup-after.png)|
|map-return-from-external|[Открыть](evidence/screenshots/map-return-from-external.png)|
|map-select-after|[Открыть](evidence/screenshots/map-select-after.png)|
|map-select-empty-keyboard|[Открыть](evidence/screenshots/map-select-empty-keyboard.png)|
|map-selected-dordoy|[Открыть](evidence/screenshots/map-selected-dordoy.png)|
|native-admin-leads|[Открыть](evidence/screenshots/native-admin-leads.png)|
|native-admin-order-detail|[Открыть](evidence/screenshots/native-admin-order-detail.png)|
|native-admin-orders|[Открыть](evidence/screenshots/native-admin-orders.png)|
|native-admin-overview|[Открыть](evidence/screenshots/native-admin-overview.png)|
|native-admin-recovery|[Открыть](evidence/screenshots/native-admin-recovery.png)|
|native-cart-after-order|[Открыть](evidence/screenshots/native-cart-after-order.png)|
|native-final-order-confirmation|[Открыть](evidence/screenshots/native-final-order-confirmation.png)|
|native-final-order-detail|[Открыть](evidence/screenshots/native-final-order-detail.png)|
|native-master-completed|[Открыть](evidence/screenshots/native-master-completed.png)|
|native-order-confirmed|[Открыть](evidence/screenshots/native-order-confirmed.png)|
|native-order-history|[Открыть](evidence/screenshots/native-order-history.png)|
|native-profile-after-update|[Открыть](evidence/screenshots/native-profile-after-update.png)|
|native-register-no-code|[Открыть](evidence/screenshots/native-register-no-code.png)|
|native-service-assigned|[Открыть](evidence/screenshots/native-service-assigned.png)|
|native-service-created|[Открыть](evidence/screenshots/native-service-created.png)|
|native-service-list|[Открыть](evidence/screenshots/native-service-list.png)|
|real-product-photo-after|[Открыть](evidence/screenshots/real-product-photo-after.png)|
|real-product-photo-before|[Открыть](evidence/screenshots/real-product-photo-before.png)|
|web-admin-order-detail|[Открыть](evidence/screenshots/web-admin-order-detail.png)|
|web-admin-orders-guest|[Открыть](evidence/screenshots/web-admin-orders-guest.png)|
|web-admin-orders-list|[Открыть](evidence/screenshots/web-admin-orders-list.png)|

## Дополнительные Android-регрессии

|Сценарий|До|После|
|---|---|---|
|Photo Picker после пересоздания Activity|[Ошибка](evidence/screenshots/picker-after-activity-recreation-before.png)|[Выбран собственный QA-файл](evidence/screenshots/picker-after-activity-recreation-after.png)|
|Возврат в заявку после входа|[Открывался кабинет](evidence/screenshots/login-context-before.png)|[Продолжена заявка](evidence/screenshots/login-context-after.png)|
|Фильтр «Использовано»|[Ошибочно доступны начисления](evidence/screenshots/native-history-filter-before.png)|[Правильный результат](evidence/screenshots/native-history-filter-after.png)|

Фиксированный +996: [пустая регистрация](evidence/screenshots/phone-prefix-register-empty.png), [9 цифр](evidence/screenshots/phone-prefix-register-local.png), [после очистки](evidence/screenshots/phone-prefix-register-cleared.png), [вход](evidence/screenshots/phone-prefix-login-empty.png).

## Правильный источник каталога и порядок владельца

До: [старый каталог с заглушками](evidence/screenshots/catalog-cards-before.png). После на Redmi Releasev16: [все товары](evidence/screenshots/storefront-all-products-after.png), [превью каталога](evidence/screenshots/storefront-catalog-preview-after.png), [выбор размера](evidence/screenshots/storefront-variant-options.png), [конкретный вариант в корзине](evidence/screenshots/storefront-cart-variant.png).

Display size: [до — обрезка430dp](evidence/screenshots/width-430-checkout.png), [после320dp](evidence/screenshots/density-after-320-action.png), [после430dp](evidence/screenshots/density-after-430-action.png). Это реальные изображения устройства; density override восстановлен.

## Карта: навигация больше не перехватывает zoom

[До](evidence/screenshots/map-tab-overlap-before.png) · [После320dp](evidence/screenshots/final-width-320-maps.png) · [После430dp](evidence/screenshots/final-width-430-maps.png) · [Корзина320dp](evidence/screenshots/final-width-320-cart.png). Физическийv17, zoom+/zoom−/pan: [результат](evidence/native-responsive-final.json).

## Установленный production APK — a13a32b

[Все товары с фото](evidence/screenshots/production-all-products.png), [варианты](evidence/screenshots/production-variants.png), [поиск](evidence/screenshots/production-search.png), [сортировка](evidence/screenshots/production-price-sort.png), [следующая страница](evidence/screenshots/production-pagination.png), [категория](evidence/screenshots/production-category.png), [вход с +996](evidence/screenshots/production-login.png). Скриншоты productionadmin с номером владельца оставлены в private локальных artifacts и вGit не добавлены.
