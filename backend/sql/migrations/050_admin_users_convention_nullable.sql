-- Admin users are not tied to a single convention.
-- Drop the NOT NULL constraint so invited admins can have convention_id = NULL.
ALTER TABLE users ALTER COLUMN convention_id DROP NOT NULL;
