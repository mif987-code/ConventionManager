-- Migration 020: Collectibles / Collection system

CREATE TABLE IF NOT EXISTS collectibles (
  id SERIAL PRIMARY KEY,
  convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  image_url TEXT,
  unlock_type VARCHAR(40) NOT NULL DEFAULT 'event_count',
  -- unlock_type: 'event_count' | 'event_type' | 'category' | 'manual'
  unlock_value VARCHAR(120),
  -- event_count: number of events, event_type: event_type_id, category: category name
  unlock_threshold INTEGER DEFAULT 1,
  -- for event_count: how many events needed; for event_type: how many of that type
  bonus_tix INTEGER DEFAULT 0,
  -- awarded when this collectible is earned
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_sets (
  id SERIAL PRIMARY KEY,
  convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  bonus_tix INTEGER DEFAULT 0,
  -- awarded when ALL collectibles in this set are earned
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_set_items (
  set_id INTEGER REFERENCES collection_sets(id) ON DELETE CASCADE,
  collectible_id INTEGER REFERENCES collectibles(id) ON DELETE CASCADE,
  PRIMARY KEY (set_id, collectible_id)
);

CREATE TABLE IF NOT EXISTS player_collectibles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  collectible_id INTEGER REFERENCES collectibles(id) ON DELETE CASCADE,
  convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, collectible_id, convention_id)
);

CREATE INDEX IF NOT EXISTS idx_player_collectibles_user ON player_collectibles(user_id, convention_id);
