ALTER TABLE runbooks ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_runbooks_workspace ON runbooks(workspace_id, name);
