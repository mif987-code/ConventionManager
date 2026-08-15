-- Special vouchers are now awarded based on Event Type category + entry cost,
-- instead of being tied to one specific pre-existing event.
-- This allows special vouchers to be created in advance and re-used across
-- multiple matching events (e.g. any "Constructed" event costing 1 voucher to enter).

ALTER TABLE special_vouchers ADD COLUMN IF NOT EXISTS convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE;
ALTER TABLE special_vouchers ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE special_vouchers ADD COLUMN IF NOT EXISTS entry_cost INTEGER;

-- Backfill existing rows (event_id was NOT NULL previously, so every row has an event)
UPDATE special_vouchers sv
SET convention_id = e.convention_id,
    category = et.category,
    entry_cost = et.entry_cost_vouchers
FROM events e
JOIN event_types et ON e.event_type_id = et.id
WHERE sv.event_id = e.id AND sv.category IS NULL;

-- event_id is no longer required to create a special voucher
ALTER TABLE special_vouchers ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE special_vouchers DROP CONSTRAINT IF EXISTS special_vouchers_event_id_fkey;

ALTER TABLE special_vouchers ALTER COLUMN category SET NOT NULL;
ALTER TABLE special_vouchers ALTER COLUMN entry_cost SET NOT NULL;
ALTER TABLE special_vouchers ALTER COLUMN convention_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_special_vouchers_convention ON special_vouchers(convention_id);
CREATE INDEX IF NOT EXISTS idx_special_vouchers_category_cost ON special_vouchers(category, entry_cost);
