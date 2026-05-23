-- Migration 004: OAuth state storage + Cloudflare Zero Trust integration
-- Stores OAuth states in DB for dual validation (cookie + DB fallback)
CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- Rename concept: NPM proxy manager -> Cloudflare Zero Trust connector
-- No schema change needed for integration_settings (it's provider-based),
-- but we clean up any leftover NPM settings if they exist.
DELETE FROM integration_settings WHERE provider = 'npm';
