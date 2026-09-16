UPDATE special_vouchers SET amount = 1 WHERE amount <> 1;

ALTER TABLE special_vouchers
  DROP CONSTRAINT IF EXISTS special_vouchers_single_use_amount_check;

ALTER TABLE special_vouchers
  ADD CONSTRAINT special_vouchers_single_use_amount_check CHECK (amount = 1);

ALTER TABLE special_vouchers ALTER COLUMN amount SET DEFAULT 1;
