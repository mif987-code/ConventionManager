-- Migration 015: Fix QR code index size issue
-- The qr_code column stores base64 images which are too large for b-tree indexes
-- Drop the index and rely on the qr_tokens table for token-based lookups

-- Drop the unique constraint on qr_code first (it creates an index)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_qr_code_key;

-- Drop the index on qr_code (it's too large for b-tree index)
DROP INDEX IF EXISTS idx_users_qr_code;

-- Note: The qr_code column remains for storing the base64 image
-- For lookups, use the qr_tokens table which stores the token string
