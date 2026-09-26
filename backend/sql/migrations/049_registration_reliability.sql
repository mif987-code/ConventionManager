CREATE UNIQUE INDEX IF NOT EXISTS idx_users_active_email_unique
  ON users (LOWER(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE store_items
  DROP CONSTRAINT IF EXISTS store_items_stock_nonnegative;
ALTER TABLE store_items
  ADD CONSTRAINT store_items_stock_nonnegative CHECK (stock >= 0);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id BIGSERIAL PRIMARY KEY,
  payment_id VARCHAR(255) NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  package_id INTEGER NOT NULL REFERENCES packages(id),
  store_item_id INTEGER NOT NULL REFERENCES store_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'released', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id, user_id, package_id, store_item_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expiry
  ON inventory_reservations(status, expires_at);

CREATE TABLE IF NOT EXISTS background_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_background_jobs_pending
  ON background_jobs(status, next_attempt_at);
