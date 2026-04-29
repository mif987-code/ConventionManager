-- Migration 018: Add is_active flag to users
-- Users are inactive by default until an admin scans their QR code

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_by INTEGER REFERENCES users(id);
