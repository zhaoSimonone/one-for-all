CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type_key TEXT NOT NULL CHECK (type_key IN ('credentials', 'infra', 'prompt', 'snippet', 'database', 'component')),
  description TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  shared_content TEXT NOT NULL,
  private_bindings JSONB NOT NULL DEFAULT '{}',
  favorite BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS assets_user_id_idx ON assets(user_id);
CREATE INDEX IF NOT EXISTS assets_type_key_idx ON assets(type_key);
CREATE INDEX IF NOT EXISTS assets_favorite_idx ON assets(favorite);
CREATE INDEX IF NOT EXISTS assets_used_at_idx ON assets(used_at DESC);
CREATE INDEX IF NOT EXISTS assets_user_updated_idx ON assets(user_id, updated_at DESC);
