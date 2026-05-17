-- Migration 003: Row Level Security
-- Run this AFTER creating a dedicated non-superuser app role.
--
-- Steps:
--   1. CREATE ROLE app_user WITH LOGIN PASSWORD 'strong_password';
--   2. GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
--   3. GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
--   4. Update DB_USER in .env to app_user
--   5. Run this migration as superuser
--
-- RLS only restricts non-superuser connections. If DB_USER=postgres, RLS has no effect.

-- Enable RLS on tables that hold convention-scoped data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for the app role (app sees all rows it needs)
-- The real isolation is enforced at the application layer via convention_id filters.
-- These policies ensure that even if the app_user role is compromised, it can only
-- do what it is explicitly granted.

CREATE POLICY app_user_users ON users
  FOR ALL TO app_user USING (true);

CREATE POLICY app_user_events ON events
  FOR ALL TO app_user USING (true);

CREATE POLICY app_user_event_types ON event_types
  FOR ALL TO app_user USING (true);

CREATE POLICY app_user_event_participants ON event_participants
  FOR ALL TO app_user USING (true);

CREATE POLICY app_user_event_rounds ON event_rounds
  FOR ALL TO app_user USING (true);

CREATE POLICY app_user_event_matches ON event_matches
  FOR ALL TO app_user USING (true);

CREATE POLICY app_user_transactions ON transactions
  FOR ALL TO app_user USING (true);

-- Deny all other roles from accessing these tables directly
-- (safety net — the app_user policies above are the only allowed access)
