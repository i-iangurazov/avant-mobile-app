// Check the actual generated release bundle, not only the build environment.
// Prevent a successful Gradle build with an empty Expo Router context from shipping.
const fs = require('node:fs');
const [bundlePath, sourceMapPath] = process.argv.slice(2);
if (!bundlePath || !sourceMapPath || !process.env.EXPO_PUBLIC_API_URL) throw Error('Usage: EXPO_PUBLIC_API_URL=https://… node scripts/build/verify-android-bundle.cjs BUNDLE PACKAGER_SOURCE_MAP');
const bundle = fs.readFileSync(bundlePath);
const map = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));
const required = ['/app/(tabs)/catalog/index.tsx', '/app/checkout/index.tsx', '/app/(auth)/login.tsx', '/src/lib/config/env.ts'];
for (const suffix of required) if (!map.sources.some(source => source.endsWith(suffix))) throw Error('Release is missing application code: ' + suffix);
const contains = value => bundle.includes(Buffer.from(value)) || bundle.includes(Buffer.from(value, 'utf16le'));
const api = process.env.EXPO_PUBLIC_API_URL;
if (new URL(api).protocol !== 'https:' || !contains(api)) throw Error('Actual release bundle does not contain the required HTTPS API.');
const phone = process.env.EXPO_PUBLIC_WHATSAPP_BUSINESS_PHONE;
if (!phone || !contains(phone)) throw Error('Actual release bundle is missing the configured WhatsApp contact.');
if (contains('http://127.0.0.1:8789')) throw Error('QA loopback API leaked into production release.');
console.log('PASS: application routes, HTTPS API and configured WhatsApp contact are present in the generated release bundle.');
