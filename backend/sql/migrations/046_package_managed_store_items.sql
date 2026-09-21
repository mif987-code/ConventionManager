ALTER TABLE store_items
  ADD COLUMN IF NOT EXISTS package_managed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE store_items
SET package_managed = TRUE
WHERE id IN (
  SELECT DISTINCT store_item_id
  FROM package_merchandise
  WHERE store_item_id IS NOT NULL
);
