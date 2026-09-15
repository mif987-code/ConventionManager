ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS prereg_start_date DATE,
  ADD COLUMN IF NOT EXISTS prereg_end_date DATE;

ALTER TABLE packages
  DROP CONSTRAINT IF EXISTS packages_preregistration_window_check;

ALTER TABLE packages
  ADD CONSTRAINT packages_preregistration_window_check
  CHECK (
    prereg_start_date IS NULL
    OR prereg_end_date IS NULL
    OR prereg_start_date <= prereg_end_date
  );
