# Админка Авантехник

Рабочая веб-админка: https://admin-web-production-4bbc.up.railway.app/admin

- Заказы покупателей: https://admin-web-production-4bbc.up.railway.app/admin/orders
- Запросы восстановления: https://admin-web-production-4bbc.up.railway.app/admin/recovery
- Заявки сантехников и обращения на услуги: разделы главного экрана `/admin`.
- Вход: https://admin-web-production-4bbc.up.railway.app/login

Это веб-интерфейс приложения. Заказы покупателей также отправляются в настроенную Telegram-группу; её кнопки меняют тот же заказ. Очередь восстановления находится в админке и не выдаёт доступ по одному телефону.

Администратор владельца создан по явному разрешению. Номер и случайный пароль находятся только в private ignored `.release-secrets/production-owner.json` (0600). Вход проверен через API и на production Android. Права проверяет сервер по текущей роли в БД, публичная регистрация их не выдаёт.

[Сведения о deployment и проверке](PRODUCTION_ACCESS.md). Утверждение процедуры проверки личности для поддержки ещё требуется; наличие админки само по себе его не заменяет.
