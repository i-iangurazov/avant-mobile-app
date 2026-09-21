-- Additive only. Apply after backup and before the no-SMS server release.
CREATE TABLE IF NOT EXISTS app_account_recovery (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_customers(id) ON DELETE CASCADE,
  phone_at_request TEXT NOT NULL,
  contact_note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  token_hash TEXT UNIQUE,
  token_expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS app_account_recovery_pending
  ON app_account_recovery(account_id) WHERE status = 'pending';
