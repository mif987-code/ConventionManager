ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS max_age INTEGER;

ALTER TABLE packages
  DROP CONSTRAINT IF EXISTS packages_max_age_check;

ALTER TABLE packages
  ADD CONSTRAINT packages_max_age_check
  CHECK (max_age IS NULL OR max_age BETWEEN 0 AND 120);
