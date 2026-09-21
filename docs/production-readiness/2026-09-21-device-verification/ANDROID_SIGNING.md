# Android release: подпись, артефакт и воспроизведение

**Production APK установлен и проверен на Redmi. Подписанный AAB готов локально; в Google Play не загружался.** Клиент `a13a32b`, package `kg.avantehnik.app`, versionName1.0.0/versionCode1, arm64-v8a, target36/min24. API: https://api-production-2e6d.up.railway.app. В фактическом Hermes bundle проверены routes, HTTPS API и WhatsApp контакт; QAloopback отсутствует.

- `artifacts/google-play/avantehnik-1.0.0-1.apk` — 29471364 байт, SHA256 `f2ff09468ae6d736198a80e549c5398b48cbd874a478b0960de2edec7e73599d`.
- `artifacts/google-play/avantehnik-1.0.0-1.aab` — 21332489 байт, SHA256 `584e6ba19e94b1b806bd6bad7031b25335d5e032b1aeaebe8328c178cca8163b`.

[Проверка подписи/ELF/хеши](evidence/play-verification.json), [manifest](evidence/play-aab-manifest.xml), [лог сборки](evidence/play-release-entry.log), [физический запуск](evidence/native-production-release.json). Проверены ZIP alignment и все17 ELF≥16KB. Runtime16KB и установка store-generated splits остаются непроверенными: Redmi использует4KB.

## Ключ

21.09 локально создан RSA3072 upload key на10000дней. Private `.release-secrets/android-upload.jks` и `credentials.json` имеют0600 и исключены изGit. Сохранить защищённую резервную копию до очистки рабочего каталога. Пароли не добавлять в команды, логи, отчёт или сообщение. [Публичный сертификат](evidence/android-upload-certificate.pem), [fingerprints](evidence/android-upload-certificate.txt).

Upload key не является Google app signing key. Перед первым upload сверить package/application record и Play App Signing; если такой package уже публиковался, сопоставить зарегистрированный сертификат.

## Фактически использованная локальная сборка

Изолированный каталог `/private/tmp/avantehnik-play-build`, JDK17.0.20.1, Node22, SDK36, NDK27.1.12297006, CMake3.22.1, Gradle8.14.3, AGP8.11.0. Архитектура arm64-v8a. Локальные зависимости совпадают с lockfile; postinstall patches обязательны. Сначала экспортирован исходный код клиента и выполнен Expo prebuild; исходный рабочий каталог/чужие изменения не перезаписывались.

Для воспроизведения в новом **пустом** изолированном каталоге:

```sh
# Выполнять в корне репозитория; никаких секретов в Git archive.
BUILD_DIR="$(mktemp -d /private/tmp/avantehnik-play-rebuild.XXXXXX)"
 git archive a13a32b | tar -x -C "$BUILD_DIR"
cd "$BUILD_DIR"
npm ci
export EXPO_NO_DOTENV=1
export EXPO_PUBLIC_API_URL=https://api-production-2e6d.up.railway.app
export EXPO_PUBLIC_WHATSAPP_BUSINESS_PHONE=+996500991966
npm run check:release-env
npx expo prebuild --platform android --clean --no-install
```

Передать `JAVA_HOME`, `ANDROID_HOME`, а также `AVANT_UPLOAD_FILE`, `AVANT_UPLOAD_STORE_PASSWORD`, `AVANT_UPLOAD_ALIAS`, `AVANT_UPLOAD_KEY_PASSWORD` из защищённого хранилища. При фактической сборке signing env загружались из private credentials дочерним Python-процессом без печати. Не использовать debug signingConfig для release.

В сгенерированном `android/app/build.gradle`: `react.root=file(projectRoot)`, signingConfigs.upload читает указанные env, release использует upload. Точное использованное содержимое без секретов сохранено в [play-app-build.gradle](evidence/play-app-build.gradle); для того же commit его можно скопировать поверх сгенерированного app/build.gradle. [align-agp.gradle](evidence/align-agp.gradle) выравнивает AGP с ReactNative0.81. Эти evidence-файлы находятся в финальном отчётном коммите, после a13a32b.

```sh
# В изолированном BUILD_DIR; SIGNING/SDK env уже переданы безопасным способом.
cd android
./gradlew -I /absolute/path/to/align-agp.gradle :app:assembleRelease :app:bundleRelease --no-daemon --max-workers=1 -PreactNativeArchitectures=arm64-v8a
cd ..
node scripts/build/verify-android-bundle.cjs android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map
```

При фактической сборке использован установленный Gradle8.14.3 с этими аргументами. Зафиксированные hash относятся к конкретным артефактам выше; повторная подпись/ZIP timestamps не обещают побайтовую идентичность. Проверить apksigner, AAB manifest, ZIP/ELF alignment и реальную установку после каждой новой сборки.

До исправления entrypoint Gradle успешно создавал bundle без app routes. `index.js` в корне и проверка actual bundle закрыли D41; ошибочные APK не были установлены или опубликованы. Одного сообщения BUILD SUCCESSFUL недостаточно.

Альтернативный EAS profile `google-play` подготовлен с local credentials; cloud build **не выполнялся**:

```sh
npm run check:release-env
npx eas-cli build --platform android --profile google-play
```

Ни EAS, ни загрузка в Console не считаются пройденной internal-track установкой. [App signing](https://developer.android.com/studio/publish/app-signing), [Expo local credentials](https://docs.expo.dev/app-signing/local-credentials/).
