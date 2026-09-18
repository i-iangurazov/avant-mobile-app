-- Review and apply to staging first; additive only. No role grants, session revocations, or data deletions.
BEGIN;
-- Additive remediation migration; never infer verification or administrator status from phone numbers.
ALTER TABLE app_customers ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS app_sessions (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES app_customers(id) ON DELETE CASCADE,
 refresh_hash TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_account_idx ON app_sessions(account_id);
CREATE TABLE IF NOT EXISTS app_phone_challenges (
 id TEXT PRIMARY KEY, account_id TEXT REFERENCES app_customers(id) ON DELETE CASCADE,
 phone TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('register','login','phone_change','password_reset','delete')),
 code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_rate_limits (
 key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE app_orders ADD COLUMN IF NOT EXISTS request_hash TEXT;

-- Populated only by a trusted inventory integration after owner approval. No public write endpoint.
CREATE TABLE IF NOT EXISTS app_order_branches (
 organization_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, address TEXT NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT false, orders_enabled BOOLEAN NOT NULL DEFAULT false,
 delivery_enabled BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id)
);
CREATE TABLE IF NOT EXISTS app_order_offers (
 organization_id TEXT NOT NULL, branch_id TEXT NOT NULL, product_id TEXT NOT NULL,
 product_name TEXT NOT NULL, unit_price_minor BIGINT CHECK(unit_price_minor >= 0 AND unit_price_minor <= 10000000000),
 request_only BOOLEAN NOT NULL DEFAULT false, stock_quantity INTEGER NOT NULL CHECK(stock_quantity >= 0),
 reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(reserved_quantity >= 0 AND reserved_quantity <= stock_quantity),
 is_active BOOLEAN NOT NULL DEFAULT false, valid_until TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(organization_id,branch_id,product_id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES app_order_branches(organization_id,id),
 CHECK(unit_price_minor IS NOT NULL OR request_only)
);
ALTER TABLE app_orders ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE app_orders ADD COLUMN IF NOT EXISTS inventory_held BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app_public_documents (
 kind TEXT NOT NULL CHECK(kind IN ('privacy','terms','loyalty','deletion')),
 version TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, approved_at TIMESTAMPTZ NOT NULL,
 is_current BOOLEAN NOT NULL DEFAULT true, PRIMARY KEY(kind,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS app_public_documents_current_idx ON app_public_documents(kind) WHERE is_current;
ALTER TABLE app_plumber_profiles ADD COLUMN IF NOT EXISTS program_document_version TEXT;
ALTER TABLE app_plumber_profiles ADD COLUMN IF NOT EXISTS privacy_document_version TEXT;
CREATE TABLE IF NOT EXISTS app_uploaded_media (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES app_customers(id) ON DELETE CASCADE,
 provider_id TEXT UNIQUE NOT NULL, url TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
