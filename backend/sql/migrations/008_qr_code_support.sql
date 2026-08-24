-- Migration 008: Add QR code support for users and convention settings

-- Add QR code field to users table (stores the base64 image)
ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;

-- Add scan_mode field to conventions table (nfc or qr, default is qr)
ALTER TABLE conventions ADD COLUMN IF NOT EXISTS scan_mode VARCHAR(10) DEFAULT 'qr' CHECK (scan_mode IN ('nfc', 'qr'));

-- QR token tracking table (for issued tokens)
CREATE TABLE IF NOT EXISTS qr_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Used tokens table (anti-replay protection)
CREATE TABLE IF NOT EXISTS used_qr_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qr_tokens_user_id ON qr_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires_at ON qr_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_used_qr_tokens_user_id ON used_qr_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_used_qr_tokens_used_at ON used_qr_tokens(used_at);
