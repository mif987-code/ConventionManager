BEGIN;

-- Store event entry cost in CRC centavos for wallet payments.
ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS entry_cost_cents integer;

-- Migrate existing data: legacy entry_cost_vouchers held the CRC colones amount.
UPDATE event_types
  SET entry_cost_cents = COALESCE(entry_cost_vouchers, 0) * 100
  WHERE entry_cost_cents IS NULL;

COMMIT;
