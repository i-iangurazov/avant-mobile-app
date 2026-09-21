CREATE TABLE IF NOT EXISTS app_customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  address TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_customers_phone_idx ON app_customers (phone);

CREATE SEQUENCE IF NOT EXISTS app_order_number_seq START WITH 1000;

CREATE TABLE IF NOT EXISTS app_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  client_request_id TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES app_customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'created',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('pickup', 'delivery')),
  store_id TEXT,
  store_name TEXT,
  store_address TEXT,
  delivery_address TEXT,
  comment TEXT,
  total_amount NUMERIC(14, 2),
  telegram_chat_id TEXT,
  telegram_message_id BIGINT,
  telegram_notification_status TEXT NOT NULL DEFAULT 'pending',
  telegram_notification_attempts INTEGER NOT NULL DEFAULT 0,
  telegram_notification_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  telegram_notification_next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS app_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES app_orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14, 2),
  unit_price_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_order_status_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES app_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  label TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_orders_customer_created_idx
  ON app_orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_orders_telegram_retry_idx
  ON app_orders (telegram_notification_status, telegram_notification_next_retry_at);
CREATE INDEX IF NOT EXISTS app_order_items_order_idx ON app_order_items (order_id);
CREATE INDEX IF NOT EXISTS app_order_status_events_order_idx
  ON app_order_status_events (order_id, created_at ASC);

-- Account capabilities are additive: every identity remains a customer and may also
-- become a plumber or administrator. This avoids duplicate accounts and keeps the
-- model ready for additional capabilities.
CREATE TABLE IF NOT EXISTS app_account_roles (
  account_id TEXT NOT NULL REFERENCES app_customers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'plumber', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  PRIMARY KEY (account_id, role)
);

INSERT INTO app_account_roles (account_id, role)
SELECT id, 'customer' FROM app_customers
ON CONFLICT (account_id, role) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_plumber_profiles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES app_customers(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  loyalty_code TEXT NOT NULL UNIQUE,
  application_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending', 'approved', 'rejected', 'suspended')),
  full_name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Бишкек',
  working_districts JSONB NOT NULL DEFAULT '[]'::jsonb,
  specializations JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 80),
  profile_photo_url TEXT,
  description TEXT,
  is_available_for_leads BOOLEAN NOT NULL DEFAULT true,
  program_consent_at TIMESTAMPTZ NOT NULL,
  data_processing_consent_at TIMESTAMPTZ NOT NULL,
  notification_preferences JSONB NOT NULL DEFAULT '{"telegram":true,"applications":true,"loyalty":true,"leads":true,"reservations":true,"content":true}'::jsonb,
  rejection_reason TEXT,
  suspension_reason TEXT,
  verified_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_plumber_profiles_status_idx
  ON app_plumber_profiles (application_status, created_at DESC);
CREATE INDEX IF NOT EXISTS app_plumber_profiles_account_idx
  ON app_plumber_profiles (account_id);

CREATE TABLE IF NOT EXISTS app_plumber_status_events (
  id TEXT PRIMARY KEY,
  plumber_id TEXT NOT NULL REFERENCES app_plumber_profiles(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_plumber_status_events_profile_idx
  ON app_plumber_status_events (plumber_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_admin_audit_created_idx
  ON app_admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS app_admin_audit_entity_idx
  ON app_admin_audit_log (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_loyalty_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_rate_bps INTEGER NOT NULL DEFAULT 100 CHECK (base_rate_bps BETWEEN 0 AND 10000),
  pending_days INTEGER NOT NULL DEFAULT 14 CHECK (pending_days BETWEEN 0 AND 365),
  rolling_period_days INTEGER NOT NULL DEFAULT 90 CHECK (rolling_period_days BETWEEN 1 AND 730),
  updated_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_loyalty_config (id, base_rate_bps, pending_days, rolling_period_days)
VALUES (1, 100, 14, 90)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_loyalty_levels (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE,
  threshold_minor BIGINT NOT NULL CHECK (threshold_minor >= 0),
  bonus_rate_bps INTEGER NOT NULL CHECK (bonus_rate_bps BETWEEN 0 AND 10000),
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pilot defaults live in data and are editable through the protected admin API.
-- They must be confirmed with AVANT before production rollout.
INSERT INTO app_loyalty_levels (id, code, name, sort_order, threshold_minor, bonus_rate_bps, benefits)
VALUES
  ('level-pro', 'pro', 'Профи', 1, 0, 100, '["Бонусы за покупки","Доступ к заявкам клиентов"]'::jsonb),
  ('level-expert', 'expert', 'Эксперт', 2, 10000000, 125, '["Повышенный бонус","Приоритетная подготовка заказа","Ранний доступ к заявкам"]'::jsonb),
  ('level-master', 'master', 'Мастер', 3, 30000000, 150, '["Максимальный бонус","Бесплатная доставка по условиям программы","Персональный менеджер"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_loyalty_promotions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('product', 'brand')),
  scope_value TEXT NOT NULL,
  multiplier_bps INTEGER NOT NULL CHECK (multiplier_bps BETWEEN 10000 AND 100000),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS app_loyalty_promotions_active_idx
  ON app_loyalty_promotions (is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS app_loyalty_exclusions (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('product', 'brand')),
  scope_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_value)
);

CREATE TABLE IF NOT EXISTS app_loyalty_receipts (
  id TEXT PRIMARY KEY,
  external_receipt_id TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  store_id TEXT NOT NULL,
  store_name TEXT,
  plumber_id TEXT NOT NULL REFERENCES app_plumber_profiles(id) ON DELETE RESTRICT,
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
  eligible_total_minor BIGINT NOT NULL CHECK (eligible_total_minor >= 0),
  purchase_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('pos', '1c', 'manual', 'fixture')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_loyalty_receipts_plumber_idx
  ON app_loyalty_receipts (plumber_id, purchase_at DESC);

CREATE TABLE IF NOT EXISTS app_loyalty_receipt_items (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES app_loyalty_receipts(id) ON DELETE CASCADE,
  external_line_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  brand TEXT,
  quantity_milli BIGINT NOT NULL CHECK (quantity_milli > 0),
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
  line_total_minor BIGINT NOT NULL CHECK (line_total_minor >= 0),
  eligible_total_minor BIGINT NOT NULL CHECK (eligible_total_minor >= 0),
  applied_rate_bps INTEGER NOT NULL CHECK (applied_rate_bps BETWEEN 0 AND 10000),
  applied_multiplier_bps INTEGER NOT NULL CHECK (applied_multiplier_bps BETWEEN 10000 AND 100000),
  base_bonus_minor BIGINT NOT NULL CHECK (base_bonus_minor >= 0),
  promo_bonus_minor BIGINT NOT NULL CHECK (promo_bonus_minor >= 0),
  returned_quantity_milli BIGINT NOT NULL DEFAULT 0 CHECK (returned_quantity_milli >= 0),
  returned_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (returned_amount_minor >= 0),
  reversed_base_bonus_minor BIGINT NOT NULL DEFAULT 0 CHECK (reversed_base_bonus_minor >= 0),
  reversed_promo_bonus_minor BIGINT NOT NULL DEFAULT 0 CHECK (reversed_promo_bonus_minor >= 0),
  UNIQUE (receipt_id, external_line_id)
);

CREATE INDEX IF NOT EXISTS app_loyalty_receipt_items_receipt_idx
  ON app_loyalty_receipt_items (receipt_id);

CREATE TABLE IF NOT EXISTS app_rewards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  description TEXT NOT NULL,
  cost_minor BIGINT NOT NULL CHECK (cost_minor > 0),
  availability_count INTEGER CHECK (availability_count IS NULL OR availability_count >= 0),
  conditions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_reward_redemptions (
  id TEXT PRIMARY KEY,
  plumber_id TEXT NOT NULL REFERENCES app_plumber_profiles(id) ON DELETE RESTRICT,
  reward_id TEXT NOT NULL REFERENCES app_rewards(id) ON DELETE RESTRICT,
  client_request_id TEXT NOT NULL,
  cost_minor BIGINT NOT NULL CHECK (cost_minor > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled')),
  processed_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  processing_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plumber_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS app_reward_redemptions_plumber_idx
  ON app_reward_redemptions (plumber_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_loyalty_returns (
  id TEXT PRIMARY KEY,
  external_return_id TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  receipt_id TEXT NOT NULL REFERENCES app_loyalty_receipts(id) ON DELETE RESTRICT,
  return_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('pos', '1c', 'manual', 'fixture')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_loyalty_return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES app_loyalty_returns(id) ON DELETE CASCADE,
  receipt_item_id TEXT NOT NULL REFERENCES app_loyalty_receipt_items(id) ON DELETE RESTRICT,
  quantity_milli BIGINT NOT NULL CHECK (quantity_milli > 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  base_bonus_reversed_minor BIGINT NOT NULL CHECK (base_bonus_reversed_minor >= 0),
  promo_bonus_reversed_minor BIGINT NOT NULL CHECK (promo_bonus_reversed_minor >= 0),
  UNIQUE (return_id, receipt_item_id)
);

CREATE TABLE IF NOT EXISTS app_loyalty_transactions (
  id TEXT PRIMARY KEY,
  plumber_id TEXT NOT NULL REFERENCES app_plumber_profiles(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase_accrual', 'promotional_multiplier', 'manual_adjustment',
    'reward_redemption', 'return_reversal', 'expiration'
  )),
  status TEXT NOT NULL CHECK (status IN ('pending', 'available', 'spent', 'reversed', 'cancelled')),
  balance_bucket TEXT NOT NULL CHECK (balance_bucket IN ('pending', 'available', 'none')),
  amount_minor BIGINT NOT NULL,
  description TEXT NOT NULL,
  receipt_id TEXT REFERENCES app_loyalty_receipts(id) ON DELETE RESTRICT,
  return_id TEXT REFERENCES app_loyalty_returns(id) ON DELETE RESTRICT,
  reward_redemption_id TEXT REFERENCES app_reward_redemptions(id) ON DELETE RESTRICT,
  source_transaction_id TEXT REFERENCES app_loyalty_transactions(id) ON DELETE RESTRICT,
  available_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (transaction_type IN ('reward_redemption', 'return_reversal', 'expiration') AND amount_minor <= 0)
    OR transaction_type NOT IN ('reward_redemption', 'return_reversal', 'expiration')
  )
);

CREATE INDEX IF NOT EXISTS app_loyalty_transactions_plumber_idx
  ON app_loyalty_transactions (plumber_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_loyalty_transactions_release_idx
  ON app_loyalty_transactions (status, available_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS app_loyalty_transactions_receipt_idx
  ON app_loyalty_transactions (receipt_id);

CREATE TABLE IF NOT EXISTS app_service_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES app_customers(id) ON DELETE RESTRICT,
  service_type TEXT NOT NULL,
  description TEXT NOT NULL,
  district TEXT NOT NULL,
  address_private TEXT,
  preferred_at TIMESTAMPTZ,
  customer_phone_private TEXT NOT NULL,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_order_id TEXT REFERENCES app_orders(id) ON DELETE SET NULL,
  consent_shared_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'viewed', 'accepted', 'declined', 'in_progress',
    'completed', 'cancelled', 'expired'
  )),
  assigned_plumber_id TEXT REFERENCES app_plumber_profiles(id) ON DELETE SET NULL,
  assigned_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_service_requests_customer_idx
  ON app_service_requests (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_service_requests_plumber_idx
  ON app_service_requests (assigned_plumber_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS app_service_requests_admin_idx
  ON app_service_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS app_service_request_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES app_service_requests(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  actor_id TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_service_request_events_request_idx
  ON app_service_request_events (request_id, created_at ASC);

CREATE TABLE IF NOT EXISTS app_plumber_reviews (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES app_service_requests(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES app_customers(id) ON DELETE RESTRICT,
  plumber_id TEXT NOT NULL REFERENCES app_plumber_profiles(id) ON DELETE RESTRICT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  moderation_status TEXT NOT NULL DEFAULT 'published'
    CHECK (moderation_status IN ('published', 'hidden', 'reported')),
  moderation_reason TEXT,
  moderated_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_plumber_reviews_profile_idx
  ON app_plumber_reviews (plumber_id, moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS app_program_content (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('promotion', 'new_product', 'training', 'master_day', 'material')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  location TEXT,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT REFERENCES app_customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_program_content_active_idx
  ON app_program_content (is_active, starts_at, created_at DESC);

CREATE TABLE IF NOT EXISTS app_training_registrations (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES app_program_content(id) ON DELETE CASCADE,
  plumber_id TEXT NOT NULL REFERENCES app_plumber_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_id, plumber_id)
);

CREATE TABLE IF NOT EXISTS app_telegram_links (
  account_id TEXT PRIMARY KEY REFERENCES app_customers(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_telegram_link_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES app_customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_telegram_link_tokens_account_idx
  ON app_telegram_link_tokens (account_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS app_notification_outbox (
  id TEXT PRIMARY KEY,
  recipient_account_id TEXT REFERENCES app_customers(id) ON DELETE CASCADE,
  target_chat_id TEXT,
  event_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  safe_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  telegram_message_id BIGINT,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  CHECK (recipient_account_id IS NOT NULL OR target_chat_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS app_notification_outbox_retry_idx
  ON app_notification_outbox (status, next_retry_at, created_at);

ALTER TABLE app_orders
  ADD COLUMN IF NOT EXISTS order_kind TEXT NOT NULL DEFAULT 'order';
ALTER TABLE app_orders
  ADD COLUMN IF NOT EXISTS project_note TEXT;

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
