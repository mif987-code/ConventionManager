-- Migration 039: Add image_url to package_merchandise and user_merchandise
ALTER TABLE package_merchandise ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE user_merchandise ADD COLUMN IF NOT EXISTS image_url TEXT;
