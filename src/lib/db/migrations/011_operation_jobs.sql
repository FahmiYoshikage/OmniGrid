CREATE TABLE IF NOT EXISTS operation_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'leased', 'running', 'succeeded', 'failed', 'cancel_requested', 'cancelled')),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  available_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  lease_owner TEXT,
  lease_expires_at INTEGER,
  cancel_requested_at INTEGER,
  result_json TEXT,
  error TEXT,
  UNIQUE (id, workspace_id)
);
CREATE INDEX IF NOT EXISTS idx_operation_jobs_ready ON operation_jobs(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_operation_jobs_workspace_status ON operation_jobs(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_jobs_lease ON operation_jobs(status, lease_expires_at);

CREATE TABLE IF NOT EXISTS operation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
    CHECK (length(CAST(data_json AS BLOB)) <= 65536),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id, workspace_id) REFERENCES operation_jobs(id, workspace_id) ON DELETE CASCADE,
  UNIQUE (job_id, workspace_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_operation_events_job ON operation_events(job_id, workspace_id, sequence);
CREATE INDEX IF NOT EXISTS idx_operation_events_workspace ON operation_events(workspace_id, created_at);
