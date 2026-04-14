-- Migration 003: Add tournament_structure to event_types
-- Values: 'swiss' (default) or 'single_elimination'

ALTER TABLE event_types ADD COLUMN IF NOT EXISTS tournament_structure TEXT NOT NULL DEFAULT 'swiss'
  CHECK (tournament_structure IN ('swiss', 'single_elimination'));
