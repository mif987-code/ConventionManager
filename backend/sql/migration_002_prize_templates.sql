-- Migration 002: Prize templates + ties support

-- Add ties variant to event_types
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS prize_structure_ties JSONB DEFAULT '{}';

-- Prize templates table
CREATE TABLE IF NOT EXISTS prize_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rounds INTEGER NOT NULL,
  prize_structure JSONB NOT NULL DEFAULT '{}',
  prize_structure_ties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
