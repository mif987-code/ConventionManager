-- Migration 038: Package and User Merchandise
CREATE TABLE IF NOT EXISTS package_merchandise (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_package_merchandise_pkg ON package_merchandise(package_id);

CREATE TABLE IF NOT EXISTS user_merchandise (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  convention_id INTEGER NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP,
  claimed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_merchandise_user ON user_merchandise(user_id);
CREATE INDEX IF NOT EXISTS idx_user_merchandise_convention ON user_merchandise(convention_id);
