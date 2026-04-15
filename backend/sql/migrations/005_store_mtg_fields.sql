-- Migration 005: Add MTG-specific fields to store_items for bulk card import

ALTER TABLE store_items ADD COLUMN IF NOT EXISTS set_name TEXT;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS card_number TEXT;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English';
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'NM';
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS foil BOOLEAN DEFAULT FALSE;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS cost INTEGER DEFAULT 0;

-- Add index for set_name to speed up filtering by set
CREATE INDEX IF NOT EXISTS idx_store_items_set_name ON store_items(set_name);
