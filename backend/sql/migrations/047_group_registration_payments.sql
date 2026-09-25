CREATE TABLE IF NOT EXISTS payment_package_users (
  payment_id VARCHAR(255) NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (payment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_package_users_user_id
  ON payment_package_users(user_id);

UPDATE event_types
SET entry_cost_colones = entry_cost_vouchers * 2500,
    entry_cost_vouchers = entry_cost_vouchers * 2500
WHERE entry_cost_vouchers > 0
  AND entry_cost_vouchers < 100;
