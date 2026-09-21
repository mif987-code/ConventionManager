ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_email TEXT;

UPDATE payments p
SET provider = CASE WHEN p.id LIKE 'mock_%' THEN 'mock' ELSE 'legacy' END,
    payer_name = COALESCE(p.payer_name, NULLIF(TRIM(CONCAT_WS(' ', u.name, u.last_name)), '')),
    payer_email = COALESCE(p.payer_email, u.email)
FROM users u
WHERE u.id = p.user_id
  AND (p.provider IS NULL OR p.payer_name IS NULL OR p.payer_email IS NULL);

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_payments_provider_status ON payments(provider, status);
