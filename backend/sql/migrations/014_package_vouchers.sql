-- Add voucher associations to packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS prereg_cost DECIMAL(10,2); -- Pre-registration cost (can be different from regular cost)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS regular_voucher_amount INTEGER DEFAULT 0; -- Amount of regular vouchers to award

-- Create table to link packages to special vouchers
CREATE TABLE IF NOT EXISTS package_special_vouchers (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  special_voucher_id INTEGER NOT NULL REFERENCES special_vouchers(id) ON DELETE CASCADE,
  UNIQUE(package_id, special_voucher_id)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_package_special_vouchers_package ON package_special_vouchers(package_id);
CREATE INDEX IF NOT EXISTS idx_package_special_vouchers_voucher ON package_special_vouchers(special_voucher_id);
