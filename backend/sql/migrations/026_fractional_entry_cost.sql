-- Migration 026: Allow fractional entry costs / voucher amounts
-- Entry costs (and the ledger amounts they debit) were previously restricted to
-- whole vouchers. This allows e.g. 0.5 voucher entry costs.

ALTER TABLE event_types ALTER COLUMN entry_cost_vouchers TYPE NUMERIC(10, 2) USING entry_cost_vouchers::NUMERIC;
ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(10, 2) USING amount::NUMERIC;
