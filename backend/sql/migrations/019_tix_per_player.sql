-- Migration 019: Add tix_per_player to event_types
ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS tix_per_player INTEGER DEFAULT NULL;
