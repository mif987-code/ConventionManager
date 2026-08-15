-- Event schedule: allow admins to place events on a visual day/time/track grid,
-- replacing the previously hand-maintained static schedule document.
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_day TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS track TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_color TEXT DEFAULT '#6366f1';
ALTER TABLE events ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_events_schedule ON events(convention_id, schedule_day, track, sort_order);
