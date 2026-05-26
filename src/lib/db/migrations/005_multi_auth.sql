CREATE TABLE IF NOT EXISTS auth_identities (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL CHECK (provider IN ('github','google','email')),
  provider_user_id  TEXT NOT NULL,
  email             TEXT,
  username          TEXT,
  display_name      TEXT,
  avatar_url        TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_email ON auth_identities(email);

INSERT OR IGNORE INTO auth_identities (
  id,
  user_id,
  provider,
  provider_user_id,
  email,
  username,
  display_name,
  avatar_url,
  created_at,
  updated_at
)
SELECT
  'github:' || CAST(github_id AS TEXT),
  id,
  'github',
  CAST(github_id AS TEXT),
  CASE WHEN email IS NULL OR TRIM(email) = '' THEN NULL ELSE LOWER(TRIM(email)) END,
  username,
  display_name,
  avatar_url,
  created_at,
  updated_at
FROM users;

CREATE TABLE IF NOT EXISTS auth_oauth_requests (
  state         TEXT PRIMARY KEY,
  provider      TEXT NOT NULL CHECK (provider IN ('github','google')),
  code_verifier TEXT,
  link_user_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_oauth_requests_expires ON auth_oauth_requests(expires_at);

CREATE TABLE IF NOT EXISTS auth_email_tokens (
  token_hash    TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  link_user_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  consumed_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_email ON auth_email_tokens(email);
CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_expires ON auth_email_tokens(expires_at);
