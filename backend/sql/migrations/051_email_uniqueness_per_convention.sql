-- Emails should not be unique globally across conventions.
-- Admin accounts keep a global unique email, but attendee emails are only
-- unique within the convention they registered for.

DROP INDEX IF EXISTS idx_users_active_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_admin_email_unique
  ON users (LOWER(email))
  WHERE is_admin = true AND email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_attendee_email_unique
  ON users (LOWER(email), convention_id)
  WHERE is_admin = false AND convention_id IS NOT NULL AND email IS NOT NULL AND deleted_at IS NULL;
