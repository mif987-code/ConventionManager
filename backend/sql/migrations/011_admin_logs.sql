-- Migration 011: Add admin_logs table for tracking admin actions

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_user_id ON admin_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
