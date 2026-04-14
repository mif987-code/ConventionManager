-- Migration 002: Store module, admin permissions, expanded transaction reasons

-- Admin permissions (JSON array of permission strings)
-- Possible values: 'super', 'register', 'vouchers', 'tix', 'store'
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '[]'::jsonb;

-- Store Items
CREATE TABLE IF NOT EXISTS store_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_tix INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Store Orders (purchase or reservation)
CREATE TABLE IF NOT EXISTS store_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_tix INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'reserved', 'cancelled', 'fulfilled')),
    order_type TEXT NOT NULL CHECK (order_type IN ('purchase', 'reserve')),
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Expand transaction reasons to include 'purchase'
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_reason_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_reason_check
    CHECK (reason IN ('topup', 'event_entry', 'prize', 'refund', 'admin_adjust', 'purchase'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_orders_user ON store_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(status);
CREATE INDEX IF NOT EXISTS idx_store_items_active ON store_items(active);
