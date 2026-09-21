
-- Inquiry mode is an explicit business workflow; no stock quantity is invented.
ALTER TABLE app_orders ADD COLUMN IF NOT EXISTS fulfilment_mode TEXT NOT NULL DEFAULT 'inventory' CHECK (fulfilment_mode IN ('inventory','inquiry'));
