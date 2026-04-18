-- Migration 017: Add payment_link column to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_link TEXT;
