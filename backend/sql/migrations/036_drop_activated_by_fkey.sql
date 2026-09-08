-- Migration 036: activated_by is an admin identifier, not a users.id.
-- The FK to users(id) made every activation fail with users_activated_by_fkey.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_activated_by_fkey;
