CREATE TABLE IF NOT EXISTS ssh_host_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'trusted', 'revoked')),
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  trusted_at INTEGER,
  trusted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  revoked_at INTEGER,
  revoked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, node_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_ssh_host_keys_node ON ssh_host_keys(workspace_id, node_id, status);
