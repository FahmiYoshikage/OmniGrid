-- Migration 002: Auth tables for GitHub OAuth login
-- Users table: stores GitHub profile info
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,                 -- uuid
  github_id     INTEGER UNIQUE NOT NULL,          -- GitHub user numeric ID
  username      TEXT NOT NULL,                    -- GitHub login/username
  display_name  TEXT,                             -- GitHub display name
  email         TEXT,                             -- GitHub email (may be null)
  avatar_url    TEXT,                             -- GitHub avatar URL
  created_at    INTEGER NOT NULL,                 -- unix epoch ms
  updated_at    INTEGER NOT NULL                  -- unix epoch ms
);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- Sessions table: database-backed sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id            TEXT PRIMARY KEY,                 -- random session token
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    INTEGER NOT NULL,                 -- unix epoch ms
  created_at    INTEGER NOT NULL                  -- unix epoch ms
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON auth_sessions(expires_at);
