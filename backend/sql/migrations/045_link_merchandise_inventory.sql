ALTER TABLE package_merchandise
  ADD COLUMN IF NOT EXISTS store_item_id INTEGER REFERENCES store_items(id) ON DELETE SET NULL;

ALTER TABLE user_merchandise
  ADD COLUMN IF NOT EXISTS store_item_id INTEGER REFERENCES store_items(id) ON DELETE SET NULL;

DO $$
DECLARE
  merchandise RECORD;
  new_store_item_id INTEGER;
BEGIN
  FOR merchandise IN
    SELECT pm.id, pm.item_name, pm.image_url, p.name AS package_name, p.convention_id
    FROM package_merchandise pm
    JOIN packages p ON p.id = pm.package_id
    WHERE pm.store_item_id IS NULL
  LOOP
    INSERT INTO store_items (name, description, price_tix, stock, image_url, active, convention_id, language, condition, foil, cost)
    VALUES (merchandise.item_name, 'Package merchandise from ' || merchandise.package_name, 0, 0, merchandise.image_url, TRUE, merchandise.convention_id, 'N/A', 'N/A', FALSE, 0)
    RETURNING id INTO new_store_item_id;

    UPDATE package_merchandise SET store_item_id = new_store_item_id WHERE id = merchandise.id;
  END LOOP;
END $$;

UPDATE user_merchandise um
SET store_item_id = pm.store_item_id
FROM package_merchandise pm
WHERE um.store_item_id IS NULL
  AND um.package_id = pm.package_id
  AND um.item_name = pm.item_name;

CREATE INDEX IF NOT EXISTS idx_package_merchandise_store_item ON package_merchandise(store_item_id);
CREATE INDEX IF NOT EXISTS idx_user_merchandise_store_item ON user_merchandise(store_item_id);
