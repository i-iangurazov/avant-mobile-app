# Native acceptance: точные шаги на выделенных тестовых устройствах

В этой сессии Android release APK/AAB собраны для arm64-v8a. iOS prebuild и Hermes export выполнены; Xcode/Pods/подпись отсутствуют, IPA нет. `adb devices -l` пуст. Установка/обновление/launch/runtime/physical проверки не выполнялись. Готовые Android файлы — `artifacts/remediation-20260918/android/`, hashes и ограничения — `evidence/android-artifacts.json`.

## Чистая сборка из review branch

Из отдельного checkout ветки `fix/production-readiness-20260918`, после получения одобренных staging backend и ключей:

```sh
nvm use
npm ci
npm run typecheck
npm run lint
export EXPO_PUBLIC_API_URL=https://APPROVED-STAGING-HOST
export EXPO_NO_DOTENV=1
npm run check:release-env
npx expo prebuild --no-install --platform android
# JAVA_HOME: JDK17; ANDROID_HOME: Android SDK с API36/build-tools36, NDK27.1.12297006, CMake3.22.1.
cd android
./gradlew :app:assembleRelease :app:bundleRelease --no-daemon --max-workers=1
```

`APPROVED-STAGING-HOST` заменить реальным host; не запускать команды с примером как будто это действующий сервис. Для повторения инженерного arm64 build добавить `-PreactNativeArchitectures=arm64-v8a`. Финальный ABI scope определить для магазина и перепроверить каждую упакованную библиотеку. По умолчанию generated Gradle release использует Android debug key: production upload signing требует отдельной настройки/проверки владельца. Не загружать инженерный artifact в Play.

В среде проверки C++ Ninja был ограничен `-j1` временной обёрткой в отдельном SDK; это не изменение продуктового source. На машине с достаточным диском/памятью обёртка не требуется. Первый параллельный build упал от отсутствия места, последующий standalone build прошёл. Wrapper download также ловил network timeout; использован тот же официальный Gradle8.14.3 с проверенным SHA-256 через GitHub release API.

Для iOS на Mac с Xcode26+:

```sh
nvm use
npm ci
export EXPO_PUBLIC_API_URL=https://APPROVED-STAGING-HOST
export EXPO_NO_DOTENV=1
npm run check:release-env
npx expo prebuild --no-install --platform ios
cd ios
pod install
# Найти сгенерированный workspace/scheme и выбрать Team/provisioning в Xcode.
xcodebuild -list -workspace Avantehnik.xcworkspace
xcodebuild -workspace Avantehnik.xcworkspace -scheme Avantehnik -configuration Release -destination 'generic/platform=iOS' -archivePath ../artifacts/Avantehnik.xcarchive archive
```

Сгенерированное имя workspace/scheme проверить `ls ios`/`xcodebuild -list`; если Expo использует другое имя, использовать фактическое. Затем Export Archive с утверждёнными ExportOptions и подписью, TestFlight install. Эти команды не исполнялись успешно здесь; provisioning не выдуман. Возможна EAS production сборка при существующем настроенном project/signing: `npx eas-cli build --platform android --profile production` / `--platform ios`; это отдельная загрузка исходников в облако владельцем, в этой сессии не запускалась.

## Сценарий и обязательные доказательства

Записать device model/OS/build fingerprint, build SHA/hash, installation source и результат каждого пункта исходных CRITERIA с physical method. Использовать только тестовые аккаунты и sandbox providers.

1. Свежая установка, холодный/тёплый launch. Если есть предыдущий artifact с той же подписью — upgrade без потери допустимых данных и с ожидаемым принудительным входом auth v2. Нет старого artifact → upgrade BLOCKED, не PASS.
2. Гость: каталог, все6 филиалов, внешние 2GIS/телефон/support/privacy/terms. Режим offline показывает fallback/retry. Селекты: поиск, нет результата, длинные значения, закрытие/back, выбор, клавиатура и focus.
3. Регистрация с реальным SMS на изолированный номер; неверный/истёкший/повторный код, reset, смена номера, выход/вход. После revoke/delete старые access/refresh отвергаются. Обычный пользователь не получает admin по номеру.
4. Заказ/резерв: server quote → подтверждение → реальные ID/позиции/timeline → пустая отправленная корзина → история → повторное открытие. Отключить сеть после server commit, восстановить/перезапустить приложение и повторить: SQL count по account+clientRequestId остаётся1, stock hold один. Проверить изменённую цену/остаток и delivery terms.
5. Бонусы: баланс и5 страниц>100 операций, filters, actual receipt/partial/full return, pending→available, redemption/cancel, два устройства и смена аккаунта. Сверка журнала с доверенным POS, без пересчёта production балансов.
6. Фото: системный picker, отмена, camera denial, ограниченная библиотека iOS, большие/повреждённые файлы, network failure, attachment ownership, metadata cleanup и удаление media. Отказ не блокирует каталог. Проверить SecureStore после удаления неиспользуемых biometric permissions.
7. Удаление: утверждённый текст, пароль, bound OTP, подтверждение, удаление данных и photo provider assets, очистка сессии/кэша, вход невозможен; web URL доступен без установленного приложения. Подтвердить procedure для внешних копий/backup.
8. Background/foreground/kill/relaunch, deep links, gestures/safe areas, system dark/light, крупный шрифт, TalkBack/VoiceOver, touch targets, compact/large screen; записать видео/снимки без реальных PII.
9. Android16KB: `adb shell getconf PAGE_SIZE` →16384, установить тот же APK, пройти launch/каталог/карту/корзину, проверить logcat на native crash/ANR. Статическое ELF/ZIP выравнивание само по себе этот пункт не закрывает.
10. Для каждого отклонения новый defect и retest. Не заменять обязательные physical сценарии Expo Go, web или одним успешным launch.
