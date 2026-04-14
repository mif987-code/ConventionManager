-- Migration 004: Add password_hash to users for player login
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
