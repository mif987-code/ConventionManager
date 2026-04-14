-- Migration: Add pre-registration fields to users table
-- Run this on an existing database to add the new columns

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_preregistered BOOLEAN DEFAULT FALSE;

-- Make nfc_uid nullable (pre-registered users won't have NFC yet)
ALTER TABLE users ALTER COLUMN nfc_uid DROP NOT NULL;
