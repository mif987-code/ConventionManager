-- Floor plan / table reservation system.
-- Note: this schema already existed in earlier deployments (applied manually)
-- but was never captured as a committed migration file until now.

CREATE TABLE IF NOT EXISTS floor_plan_tables (
  id SERIAL PRIMARY KEY,
  convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE,
  table_number VARCHAR(20) NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  w DOUBLE PRECISION NOT NULL,
  h DOUBLE PRECISION NOT NULL,
  area_id INTEGER,
  area_name VARCHAR(100),
  area_color VARCHAR(20),
  UNIQUE (convention_id, table_number)
);

CREATE TABLE IF NOT EXISTS floor_plans (
  id SERIAL PRIMARY KEY,
  convention_id INTEGER UNIQUE REFERENCES conventions(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS table_id INTEGER REFERENCES floor_plan_tables(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);

CREATE TABLE IF NOT EXISTS table_reservations (
  id SERIAL PRIMARY KEY,
  table_id INTEGER REFERENCES floor_plan_tables(id),
  event_id INTEGER REFERENCES events(id),
  convention_id INTEGER REFERENCES conventions(id),
  reserved_by INTEGER,
  reserved_at TIMESTAMP DEFAULT NOW(),
  released_at TIMESTAMP
);
