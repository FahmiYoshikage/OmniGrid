-- 014_node_health.sql
-- Periodic and on-demand container snapshots and node reachability health checks

CREATE TABLE IF NOT EXISTS node_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL DEFAULT '__local__',
  source_name TEXT NOT NULL,
  containers_json TEXT NOT NULL DEFAULT '[]',
  is_reachable INTEGER NOT NULL DEFAULT 1,
  docker_reachable INTEGER NOT NULL DEFAULT 1,
  latency_ms INTEGER,
  error_message TEXT,
  last_scanned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_snapshots_workspace ON node_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_node_snapshots_scanned ON node_snapshots(last_scanned_at);
