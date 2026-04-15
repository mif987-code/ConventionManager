-- Add conventions table and foreign keys to all data tables

CREATE TABLE IF NOT EXISTS conventions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, ended
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL
);

-- Add convention_id to all data tables
ALTER TABLE users ADD COLUMN convention_id INTEGER REFERENCES conventions(id);
ALTER TABLE event_types ADD COLUMN convention_id INTEGER REFERENCES conventions(id);
ALTER TABLE events ADD COLUMN convention_id INTEGER REFERENCES conventions(id);
ALTER TABLE event_participants ADD COLUMN convention_id INTEGER REFERENCES conventions(id);
ALTER TABLE event_rounds ADD COLUMN convention_id INTEGER REFERENCES conventions(id);
ALTER TABLE event_matches ADD COLUMN convention_id INTEGER REFERENCES conventions(id);
ALTER TABLE store_items ADD COLUMN convention_id INTEGER REFERENCES conventions(id);
ALTER TABLE store_orders ADD COLUMN convention_id INTEGER REFERENCES conventions(id);
ALTER TABLE transactions ADD COLUMN convention_id INTEGER REFERENCES conventions(id);

-- Set existing data to a default convention
INSERT INTO conventions (name, status) VALUES ('Default Convention', 'active') ON CONFLICT DO NOTHING;
UPDATE users SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;
UPDATE event_types SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;
UPDATE events SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;
UPDATE event_participants SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;
UPDATE event_rounds SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;
UPDATE event_matches SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;
UPDATE store_items SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;
UPDATE store_orders SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;
UPDATE transactions SET convention_id = (SELECT id FROM conventions WHERE name = 'Default Convention' LIMIT 1) WHERE convention_id IS NULL;

-- Make convention_id NOT NULL after migration
ALTER TABLE users ALTER COLUMN convention_id SET NOT NULL;
ALTER TABLE event_types ALTER COLUMN convention_id SET NOT NULL;
ALTER TABLE events ALTER COLUMN convention_id SET NOT NULL;
ALTER TABLE event_participants ALTER COLUMN convention_id SET NOT NULL;
ALTER TABLE event_rounds ALTER COLUMN convention_id SET NOT NULL;
ALTER TABLE event_matches ALTER COLUMN convention_id SET NOT NULL;
ALTER TABLE store_items ALTER COLUMN convention_id SET NOT NULL;
ALTER TABLE store_orders ALTER COLUMN convention_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN convention_id SET NOT NULL;
