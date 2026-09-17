CREATE TABLE IF NOT EXISTS runbook_revisions (
  id TEXT PRIMARY KEY,
  runbook_id TEXT NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  shell TEXT NOT NULL,
  body_enc TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (runbook_id, revision_number)
);
CREATE INDEX IF NOT EXISTS idx_runbook_revisions_lookup ON runbook_revisions(workspace_id, runbook_id, revision_number DESC);

CREATE TABLE IF NOT EXISTS runbook_executions (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  runbook_id TEXT NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  revision_id TEXT REFERENCES runbook_revisions(id) ON DELETE SET NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
  exit_code INTEGER,
  duration_ms INTEGER,
  error TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  UNIQUE (id, workspace_id)
);
CREATE INDEX IF NOT EXISTS idx_runbook_executions_runbook ON runbook_executions(workspace_id, runbook_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runbook_executions_node ON runbook_executions(workspace_id, node_id, started_at DESC);
