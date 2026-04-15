-- Migration 008: Add QR code support for users and convention settings

-- Add QR code field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;

-- Add scan_mode field to conventions table (nfc or qr, default is qr)
ALTER TABLE conventions ADD COLUMN IF NOT EXISTS scan_mode VARCHAR(10) DEFAULT 'qr' CHECK (scan_mode IN ('nfc', 'qr'));

-- Create index for qr_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_qr_code ON users(qr_code);
