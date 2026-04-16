-- Special Vouchers for Events
-- These are event-specific vouchers that can be awarded as special prizes

CREATE TABLE IF NOT EXISTS special_vouchers (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL, -- Number of vouchers this special voucher represents
  icon VARCHAR(50) DEFAULT 'star', -- Icon for display (e.g., 'star', 'trophy', 'gift')
  color VARCHAR(20) DEFAULT '#6366f1', -- Display color (hex)
  max_awards INTEGER DEFAULT 1, -- Maximum number of times this can be awarded per event
  awarded_count INTEGER DEFAULT 0, -- Track how many times this has been awarded
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by event
CREATE INDEX idx_special_vouchers_event_id ON special_vouchers(event_id);

-- Track which users received which special vouchers
CREATE TABLE IF NOT EXISTS special_voucher_awards (
  id SERIAL PRIMARY KEY,
  special_voucher_id INTEGER NOT NULL REFERENCES special_vouchers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  awarded_by VARCHAR(255) DEFAULT 'admin',
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(special_voucher_id, user_id, event_id) -- Prevent duplicate awards
);

-- Index for faster lookups
CREATE INDEX idx_special_voucher_awards_user_id ON special_voucher_awards(user_id);
CREATE INDEX idx_special_voucher_awards_event_id ON special_voucher_awards(event_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_special_vouchers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER special_vouchers_updated_at
  BEFORE UPDATE ON special_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION update_special_vouchers_updated_at();
