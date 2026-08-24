BEGIN;

-- Track when an on-demand special voucher is actually used for event entry.
ALTER TABLE special_voucher_awards
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

COMMIT;
