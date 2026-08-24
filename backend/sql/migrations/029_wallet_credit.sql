-- Migration 029: Wallet / credit ledger infrastructure
-- Stores credit deposits, payments, refunds, and adjustments per user per convention.

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  convention_id INTEGER NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'payment', 'refund', 'adjustment', 'prize')),
  reason TEXT,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  payment_link TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_convention ON wallet_transactions(user_id, convention_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_event ON wallet_transactions(event_id);
