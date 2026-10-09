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
  -- AES-256-GCM ciphertext. Never store private values as plaintext JSON.
  private_bindings TEXT NOT NULL DEFAULT '',
  favorite BOOLEAN NOT NULL DEFAULT false,
  use_count INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existing deployments: add the copy counter column if it is missing.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS use_count INTEGER NOT NULL DEFAULT 0;

-- Security-relevant events. Metadata must never contain secret values.
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  ip_address INET,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS assets_user_id_idx ON assets(user_id);
CREATE INDEX IF NOT EXISTS assets_type_key_idx ON assets(type_key);
CREATE INDEX IF NOT EXISTS assets_favorite_idx ON assets(favorite);
CREATE INDEX IF NOT EXISTS assets_used_at_idx ON assets(used_at DESC);
CREATE INDEX IF NOT EXISTS assets_user_updated_idx ON assets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_asset_created_idx ON audit_logs(asset_id, created_at DESC);

-- Upgrade databases created by the initial skeleton, where this column was JSONB.
-- Refuse to cast non-empty JSONB values: doing so would leave plaintext secrets in
-- a TEXT column and make them look like encrypted payloads to the application.
DO $$
DECLARE column_type TEXT;
BEGIN
  SELECT data_type INTO column_type
  FROM information_schema.columns
  WHERE table_name = 'assets' AND column_name = 'private_bindings';
  IF column_type = 'jsonb' THEN
    IF EXISTS (SELECT 1 FROM assets WHERE private_bindings <> '{}'::jsonb) THEN
      RAISE EXCEPTION 'assets.private_bindings contains legacy plaintext; export, encrypt, and re-import before migration';
    END IF;
    ALTER TABLE assets ALTER COLUMN private_bindings TYPE TEXT
      USING '';
  END IF;
END $$;
