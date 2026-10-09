-- Additive only; do not alter existing chat history or quota.
-- Apply deliberately with wrangler d1 migrations apply agentssdkspace --remote.
CREATE TABLE IF NOT EXISTS sandbox_sessions (
  session_id TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_owner_created
  ON sandbox_sessions (user_key, created_at DESC);
