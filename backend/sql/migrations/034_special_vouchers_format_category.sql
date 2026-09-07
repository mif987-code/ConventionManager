-- Migration 034: Add format to special_vouchers and ensure category can be nullable/flexible
-- Also ensure consumed_at exists on special_voucher_awards and event_id is nullable

ALTER TABLE special_vouchers
  ADD COLUMN IF NOT EXISTS format VARCHAR(100);

ALTER TABLE special_vouchers
  ALTER COLUMN category DROP NOT NULL;

ALTER TABLE special_voucher_awards
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

ALTER TABLE special_voucher_awards
  ALTER COLUMN event_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_special_vouchers_cat_format ON special_vouchers(category, format);
