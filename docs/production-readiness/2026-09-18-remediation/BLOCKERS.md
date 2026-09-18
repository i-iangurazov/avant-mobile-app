# Оставшиеся препятствия

Из11 исходных release blockers закрыты4: D01,D02,D03,D11. Остались7: **D06,D07,D08,D09,D10,D12,D16**. Точные исходные acceptance и доказательства сохранены в [CLOSURE](CLOSURE.md); D16 — IMPLEMENTED, NOT VERIFIED, остальные6 — BLOCKED. Помимо этого D14 BLOCKED, D17 IMPLEMENTED, NOT VERIFIED.

1. D06–D08: утверждённые тексты privacy/terms/loyalty/deletion, retention и внешние копии, реальные SMS и web deletion URL, native проверка. Нельзя объявлять TEST fixture действующим документом.
2. D09–D10: подтвердить адреса/контакты/часы, дать поддерживаемый map key и координаты; iframe popup всё ещё обрезается. Native gestures/geolocation/external apps не проверены.
3. D12: наполнить доверенный catalog и подключить inventory/POS; реальные товары не получили выдуманных фото/описаний/цен. Нужна совместимость с общим backend Bazaar и другими клиентами.
4. D14/D16: реальный media decode/storage/delete adapter, проверка picker/camera/denial на подписанных релизах. Manifest уже минимален; runtime не подтверждён.
5. D17: staging topology/proxy/replicas и нагрузка. Локально два процесса/restart/XFF подтверждены, исходный staging acceptance не заменён.
6. Новые обязательные gates EX-01..04: SMS, inventory, media, incident review администраторов/legacy sessions. Без массового отзыва или удаления production данных до отдельного плана владельца.
7. Android upload key и supported ABI/runtime16KB; iOS Xcode26+/SDK26/Pods/team/provisioning; реальные устройства, fresh/upgrade релиз, review credentials и заполнение обеих консолей. Q05: согласование UGC reporting/blocking/операционной модерации тоже остаётся store gate.

## Исходные риски и вопросы вне17 дефектов

|ID|Результат|
|---|---|
|R01|FIXED & VERIFIED: ключ/тело/accepted result хранятся до восстановления; CDP потеря201 после commit, reload, один заказ.|
|R02|FIXED & VERIFIED локально: все страницы до глобального sort/filter,137 разнесённых SKU; реальные большие объёмы/performance остаются BLOCKED.|
|R03|FIXED & VERIFIED: DB sessions, access15min, refresh rotation/revoke; auth v2 требует совместимого rollout.|
|R04|IMPLEMENTED, NOT VERIFIED: health делает SELECT1 и проверяет обязательную конфигурацию; не доказывает реальную доставку всех интеграций.|
|R05|FIXED & VERIFIED по audit/build:0 advisories, достижимые пакеты обновлены, Metro совместимость/export проверены; runtime malicious deep-link на устройствах не проверен.|
|R06|IMPLEMENTED, NOT VERIFIED: expo-system-ui установлен, prebuild проходит; native dark inversion не проверена.|
|R07|FIXED & VERIFIED: revocation/401 очищает cached identity, account switch/cache purge проверены web.|
|Q01|BLOCKED: ставки/округление/negative debt/baseRate0/уровни требуют утверждения; текущий ledger не переписан.|
|Q02|BLOCKED для integration acceptance:404 до чека и повтор после чека проверены; POS должен подтвердить retry этого случая.|
|Q03|IMPLEMENTED, NOT VERIFIED полностью: reset с bound OTP и отзывом сессий проверен локально; реальный SMS/support остаются.|
|Q04|BLOCKED: граница quote/reservation/обязательного заказа, delivery fee/holds и inventory source требуют согласования.|
|Q05|BLOCKED: применимость UGC report/block/модерации и действия оператора не подтверждены.|

Действия и точные вопросы владельцу: [OWNER_ACTIONS](OWNER_ACTIONS.md). Ни один из этих gates не исключён из оценки ради повышения процентов.
