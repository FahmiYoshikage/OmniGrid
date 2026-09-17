CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('telegram', 'discord', 'email', 'webhook')),
  enabled INTEGER NOT NULL DEFAULT 1,
  config_enc TEXT NOT NULL,
  events_json TEXT NOT NULL DEFAULT '["uptime.incident", "node.down", "runbook.failure"]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_notification_channels_ws ON notification_channels(workspace_id, enabled);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
  response_code INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_ws ON notification_deliveries(workspace_id, created_at DESC);
