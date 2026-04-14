-- Convention Manager Database Schema
-- PostgreSQL

-- USERS TABLE
-- Stores player info and NFC UID
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    last_name TEXT,
    nfc_uid TEXT UNIQUE,
    email TEXT,
    age INTEGER,
    dob DATE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_preregistered BOOLEAN DEFAULT FALSE,
    days_playing INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- EVENT TYPES
-- Defines formats (entry cost, prize structure)
-- category: Draft, Sealed, Constructed, Commander
-- format: Standard, Modern, Pioneer, PreModern (only for Constructed)
-- prize_structure: W-L record keys e.g. {"3-0": 100, "2-1": 60, "1-2": 20, "0-3": 0}
CREATE TABLE IF NOT EXISTS event_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Draft',
    format TEXT,
    entry_cost_vouchers INTEGER NOT NULL,
    max_players INTEGER DEFAULT 8,
    prize_structure JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- EVENTS
-- Actual events created from event types
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    event_type_id INTEGER NOT NULL REFERENCES event_types(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'ongoing', 'finished', 'cancelled')),
    current_round INTEGER DEFAULT 0,
    total_rounds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP
);

-- EVENT PARTICIPANTS
-- Links users to events and stores results
CREATE TABLE IF NOT EXISTS event_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    result_position INTEGER,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    match_points INTEGER DEFAULT 0,
    registered_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- EVENT ROUNDS
CREATE TABLE IF NOT EXISTS event_rounds (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, round_number)
);

-- EVENT MATCHES
CREATE TABLE IF NOT EXISTS event_matches (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES event_rounds(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    player1_wins INTEGER DEFAULT 0,
    player2_wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    reported BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TRANSACTIONS (LEDGER)
-- Immutable ledger for both vouchers and tix
-- Balance = SUM(amount) WHERE user_id = X AND type = Y
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('voucher', 'tix')),
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('topup', 'event_entry', 'prize', 'refund', 'admin_adjust')),
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_nfc_uid ON users(nfc_uid);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_event_rounds_event ON event_rounds(event_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_round ON event_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_event ON event_matches(event_id);
