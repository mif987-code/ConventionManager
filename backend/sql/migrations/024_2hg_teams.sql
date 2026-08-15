-- 2-Headed Giant (2HG) team support
-- event_types gain a team_mode: 'single' (default, one player per seat) or '2hg' (paired teams)
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS team_mode TEXT NOT NULL DEFAULT 'single';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_types_team_mode_check'
  ) THEN
    ALTER TABLE event_types ADD CONSTRAINT event_types_team_mode_check
      CHECK (team_mode IN ('single', '2hg'));
  END IF;
END $$;

-- A team = exactly 2 linked players competing as one unit within a single event
CREATE TABLE IF NOT EXISTS event_teams (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    member1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, member1_id),
    UNIQUE(event_id, member2_id)
);

ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES event_teams(id) ON DELETE SET NULL;

-- Matches store the individual representative in player1_id/player2_id (for compatibility with
-- existing Swiss/single-elim pairing + reporting code) plus the team ids for 2HG events, so
-- results and prizes can be mirrored to both members of each team.
ALTER TABLE event_matches ADD COLUMN IF NOT EXISTS team1_id INTEGER REFERENCES event_teams(id) ON DELETE SET NULL;
ALTER TABLE event_matches ADD COLUMN IF NOT EXISTS team2_id INTEGER REFERENCES event_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_teams_event ON event_teams(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_team ON event_participants(team_id);
