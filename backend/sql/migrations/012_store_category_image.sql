-- Migration 012: Add category to store_items and convert cost to DECIMAL

-- Add category column
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'cards' CHECK (category IN ('cards', 'sealed', 'merchandise'));

-- Convert cost from INTEGER to DECIMAL(10,2) for dollar amounts
ALTER TABLE store_items ALTER COLUMN cost TYPE DECIMAL(10,2) USING cost::DECIMAL(10,2);

-- Add index for category
CREATE INDEX IF NOT EXISTS idx_store_items_category ON store_items(category);
