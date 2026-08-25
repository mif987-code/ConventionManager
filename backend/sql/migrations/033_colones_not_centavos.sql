BEGIN;

-- Costa Rican Colones are used as whole units; centavos are not needed.
-- Convert existing centavo-stored amounts back to whole colones.
ALTER TABLE event_types RENAME COLUMN entry_cost_cents TO entry_cost_colones;
UPDATE event_types
  SET entry_cost_colones = entry_cost_colones / 100
  WHERE entry_cost_colones IS NOT NULL;

ALTER TABLE wallet_transactions RENAME COLUMN amount_cents TO amount_colones;
UPDATE wallet_transactions
  SET amount_colones = amount_colones / 100;

COMMIT;
