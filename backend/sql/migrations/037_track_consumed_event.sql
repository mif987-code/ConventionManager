-- Migration 037: Track which special voucher award and which event consumed it
ALTER TABLE special_voucher_awards
  ADD COLUMN IF NOT EXISTS consumed_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sva_consumed_event ON special_voucher_awards(consumed_event_id);
