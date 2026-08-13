CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

CREATE TABLE IF NOT EXISTS integration_settings (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,
  key         TEXT NOT NULL,
  value_enc   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE(workspace_id, provider, key)
);
CREATE INDEX IF NOT EXISTS idx_integration_settings_workspace ON integration_settings(workspace_id, provider);

ALTER TABLE nodes ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE credentials ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE audit_log ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_nodes_workspace ON nodes(workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_credentials_workspace ON credentials(workspace_id, label);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_ts ON audit_log(workspace_id, ts DESC);
