CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id, workspace_id);

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id, created_at DESC);

INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
SELECT id, owner_id, 'owner', created_at, updated_at FROM workspaces;
