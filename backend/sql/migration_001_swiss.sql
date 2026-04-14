-- Migration 001: Swiss rounds, matches, W/L-based prizes, Constructed category
-- Run this on existing databases

-- Add category/format to event_types
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Draft';
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add current round tracking to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 0;

-- Add W/L/D tracking to participants
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS draws INTEGER DEFAULT 0;
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS match_points INTEGER DEFAULT 0;

-- Rounds table
CREATE TABLE IF NOT EXISTS event_rounds (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, round_number)
);

-- Matches table
CREATE TABLE IF NOT EXISTS event_matches (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES event_rounds(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    player1_wins INTEGER DEFAULT 0,
    player2_wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    reported BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_rounds_event ON event_rounds(event_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_round ON event_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_event ON event_matches(event_id);

-- Update existing event types with categories
UPDATE event_types SET category = 'Draft' WHERE LOWER(name) = 'draft';
UPDATE event_types SET category = 'Sealed' WHERE LOWER(name) = 'sealed';
UPDATE event_types SET category = 'Constructed', format = 'Standard' WHERE LOWER(name) = 'standard';
UPDATE event_types SET category = 'Commander' WHERE LOWER(name) = 'commander';
