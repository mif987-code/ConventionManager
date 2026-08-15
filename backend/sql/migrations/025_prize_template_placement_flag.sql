-- Migration 025: Explicit placement flag on prize templates
-- Previously "rounds = 1" was overloaded to mean "Commander-style placement prizes",
-- which caused ambiguity with a genuine "1 round, win/loss record" template.
-- This adds an explicit boolean so templates are unambiguous regardless of rounds count.

ALTER TABLE prize_templates ADD COLUMN IF NOT EXISTS is_placement BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing rounds = 1 templates were always placement-style (Commander).
UPDATE prize_templates SET is_placement = true WHERE rounds = 1;
