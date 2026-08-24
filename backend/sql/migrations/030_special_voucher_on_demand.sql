-- Migration 030: Add voucher_type to special_vouchers and remove the entry_cost NOT NULL requirement.
-- This supports On-Demand and other type-based special vouchers that are no longer tied to an event cost.

ALTER TABLE special_vouchers
  ADD COLUMN IF NOT EXISTS voucher_type VARCHAR(50) NOT NULL DEFAULT 'category';

ALTER TABLE special_vouchers
  ALTER COLUMN entry_cost DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_special_vouchers_voucher_type ON special_vouchers(voucher_type);
