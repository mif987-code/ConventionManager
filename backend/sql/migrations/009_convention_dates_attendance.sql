-- Migration 009: Add convention dates and user attendance tracking

-- Add start_date and end_date to conventions table
ALTER TABLE conventions ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE conventions ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add constraint to ensure end_date is after or equal to start_date
ALTER TABLE conventions ADD CONSTRAINT check_dates_valid CHECK (end_date >= start_date);

-- Create user_attendance table to track which dates each user attends
CREATE TABLE IF NOT EXISTS user_attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, convention_id, attendance_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_attendance_user_id ON user_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_user_attendance_convention_id ON user_attendance(convention_id);
CREATE INDEX IF NOT EXISTS idx_user_attendance_date ON user_attendance(attendance_date);

-- Add settings table for admin configuration (QR_SECRET_KEY, etc.)
CREATE TABLE IF NOT EXISTS admin_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

-- Insert default QR_SECRET_KEY if not exists
INSERT INTO admin_settings (key, value) 
VALUES ('qr_secret_key', 'change-this-secret-key-in-production')
ON CONFLICT (key) DO NOTHING;
