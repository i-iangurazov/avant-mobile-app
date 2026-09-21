# Production access

API: https://api-production-2e6d.up.railway.app

Admin: https://admin-web-production-4bbc.up.railway.app/admin

Orders: https://admin-web-production-4bbc.up.railway.app/admin/orders

Recovery: https://admin-web-production-4bbc.up.railway.app/admin/recovery

Owner account and random password are in the private ignored .release-secrets/production-owner.json (0600). Never commit credentials. Admin access is enforced by database role.

Deployment: API 3caef0b4-db70-4fae-b6b3-700c3d612766; admin-web 41e0802e-cfaa-4422-8c78-30d620d7d158. Three original accounts copied without changes to password hashes; old Railway DB preserved. Current catalog source is the shared website database.

Live test AV-20260921-01000: Telegram delivered; owner pressed Confirmed; source telegram_admin recorded on the same order. No payment or inventory held. This labelled test order must not be fulfilled; cancel it using its Telegram button when finished.

Google Play has not received an upload. Signed candidate AAB/APK are under artifacts/google-play/. Public policies, deletion retention, loyalty rules, reviewer access and remaining device/store checks are release gates.
