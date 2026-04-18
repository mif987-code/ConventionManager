-- Add packages table for convention registration packages
CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  convention_id INTEGER NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  days INTEGER NOT NULL, -- Number of days included
  cost DECIMAL(10,2) NOT NULL, -- Cost in dollars
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(convention_id, name)
);

-- Add user_packages table to track package selections
CREATE TABLE IF NOT EXISTS user_packages (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  convention_id INTEGER NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, convention_id)
);

-- Add preregistration_enabled field to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS preregistration_enabled BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_packages_convention ON packages(convention_id);
CREATE INDEX IF NOT EXISTS idx_packages_active ON packages(convention_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_packages_user ON user_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_convention ON user_packages(convention_id);
