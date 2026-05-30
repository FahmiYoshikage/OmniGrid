-- Migration 006: Uptime monitors and improved history
-- Adds a configurable monitors table so users can define what to monitor,
-- and enhances uptime_history with workspace scoping + richer metadata.

CREATE TABLE IF NOT EXISTS uptime_monitors (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('http','tcp','ping')),
  target        TEXT NOT NULL,               -- URL for http, host:port for tcp, host for ping
  interval_sec  INTEGER NOT NULL DEFAULT 60, -- check interval in seconds
  timeout_ms    INTEGER NOT NULL DEFAULT 10000,
  method        TEXT DEFAULT 'GET',          -- HTTP method (only for http kind)
  expected_status INTEGER,                   -- expected HTTP status code (null = any 2xx)
  headers_json  TEXT,                        -- custom HTTP headers as JSON object
  body          TEXT,                        -- request body for POST/PUT
  enabled       INTEGER NOT NULL DEFAULT 1,
  notify        INTEGER NOT NULL DEFAULT 1,  -- whether to send alerts on state change
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_uptime_monitors_workspace ON uptime_monitors(workspace_id, enabled);

-- Add workspace_id to uptime_history (existing column may not have it)
-- We recreate the table cleanly since the old one was never used in production.
DROP TABLE IF EXISTS uptime_history;
CREATE TABLE uptime_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  monitor_id  TEXT NOT NULL REFERENCES uptime_monitors(id) ON DELETE CASCADE,
  ts          INTEGER NOT NULL,
  ok          INTEGER NOT NULL,               -- 0/1
  status_code INTEGER,                        -- HTTP status code (null for tcp/ping)
  latency_ms  INTEGER,
  error       TEXT,
  region      TEXT DEFAULT 'local'            -- future: multi-region probing
);
CREATE INDEX IF NOT EXISTS idx_uptime_history_monitor_ts ON uptime_history(monitor_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_history_workspace ON uptime_history(workspace_id, ts DESC);

-- Incidents: tracks state transitions (up→down, down→up)
CREATE TABLE IF NOT EXISTS uptime_incidents (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  monitor_id  TEXT NOT NULL REFERENCES uptime_monitors(id) ON DELETE CASCADE,
  started_at  INTEGER NOT NULL,
  resolved_at INTEGER,                        -- null = ongoing
  cause       TEXT,                           -- first error message
  checks_failed INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_uptime_incidents_monitor ON uptime_incidents(monitor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_incidents_workspace ON uptime_incidents(workspace_id, started_at DESC);
