-- Migration 027: Fix missing `preregistered` flag on event_participants
--
-- publicRegistration.ts has been inserting into event_participants with a
-- `preregistered` column since the pre-registration site was built, but no
-- migration ever actually created it. Adding it now also backs the new
-- admin "Preregistered" stats tab and the player-app self-service editing.
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS preregistered BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_event_participants_preregistered ON event_participants(preregistered);
