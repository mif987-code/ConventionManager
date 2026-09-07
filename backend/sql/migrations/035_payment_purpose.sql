-- Migration 035: Distinguish package purchases from wallet top-ups.
-- 'topup'   → amount is deposited as wallet credit when paid (admin POS flow)
-- 'package' → package vouchers / special vouchers are awarded when paid; no credit
ALTER TABLE payments ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'topup';

CREATE INDEX IF NOT EXISTS idx_payments_purpose ON payments(purpose);
