-- OmniGrid initial schema (v1).
-- All timestamps are unix epoch milliseconds (INTEGER) for cheap math + indexing.

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- Nodes: anything we manage (Tailscale device, raw SSH host, VPS, etc.)
CREATE TABLE IF NOT EXISTS nodes (
  id            TEXT PRIMARY KEY,           -- uuid
  name          TEXT NOT NULL UNIQUE,
  hostname      TEXT NOT NULL,              -- tailscale name or IP/DNS
  tailscale_id  TEXT,                       -- nullable for non-tailnet hosts
  os            TEXT,
  tags          TEXT,                       -- JSON array
  ssh_user      TEXT,
  ssh_port      INTEGER NOT NULL DEFAULT 22,
  ssh_mode      TEXT NOT NULL DEFAULT 'tailscale'  -- 'tailscale' | 'key' | 'password'
                CHECK (ssh_mode IN ('tailscale','key','password')),
  credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
  mac_address   TEXT,                       -- for Wake-on-LAN
  wol_broadcast TEXT,                       -- e.g. 192.168.1.255
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_nodes_tailscale_id ON nodes(tailscale_id);

-- Credentials: encrypted at rest (AES-256-GCM via lib/crypto).
CREATE TABLE IF NOT EXISTS credentials (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('ssh_key','password')),
  secret_enc   TEXT NOT NULL,               -- base64(iv|tag|ct)
  passphrase_enc TEXT,                      -- optional, for encrypted keys
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Reusable bash snippets. body_enc because runbooks may carry secrets/tokens.
CREATE TABLE IF NOT EXISTS runbooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  body_enc    TEXT NOT NULL,
  shell       TEXT NOT NULL DEFAULT 'bash',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Audit log of SSH/runbook activity. High write volume → keep narrow + indexed.
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  actor       TEXT NOT NULL,                -- tailscale identity / system
  action      TEXT NOT NULL,                -- ssh.open, ssh.close, runbook.run, ...
  node_id     TEXT,
  session_id  TEXT,
  detail      TEXT                          -- JSON blob (command, exit code, etc)
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_node ON audit_log(node_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);



-- Cached snapshot of NPM proxy hosts so the dashboard renders fast even when
-- NPM is slow. Source-of-truth remains NPM itself.
CREATE TABLE IF NOT EXISTS proxy_hosts_cache (
  id            INTEGER PRIMARY KEY,        -- NPM's own id
  domain_names  TEXT NOT NULL,              -- JSON array
  forward_host  TEXT NOT NULL,
  forward_port  INTEGER NOT NULL,
  forward_scheme TEXT NOT NULL,
  enabled       INTEGER NOT NULL,
  ssl           INTEGER NOT NULL,
  raw           TEXT,                       -- original JSON for completeness
  refreshed_at  INTEGER NOT NULL
);
