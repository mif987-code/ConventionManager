-- Package types: distinguish day passes from voucher/merchandise-only packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS package_type VARCHAR(20) NOT NULL DEFAULT 'day_pass';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_type_check'
  ) THEN
    ALTER TABLE packages ADD CONSTRAINT packages_type_check
      CHECK (package_type IN ('day_pass', 'voucher_pack', 'merchandise'));
  END IF;
END $$;

-- days is allowed to be 0 for voucher_pack / merchandise packages (no schema change needed,
-- days is already a plain INTEGER with no CHECK >= 1 constraint; the app-layer validation is updated separately)

-- Support selecting multiple packages per user (with quantity/multiplier) instead of just one
ALTER TABLE user_packages ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE user_packages ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_packages_pkey'
  ) THEN
    ALTER TABLE user_packages ADD CONSTRAINT user_packages_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE user_packages DROP CONSTRAINT IF EXISTS user_packages_user_id_convention_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_packages_unique'
  ) THEN
    ALTER TABLE user_packages ADD CONSTRAINT user_packages_unique UNIQUE(user_id, convention_id, package_id);
  END IF;
END $$;
