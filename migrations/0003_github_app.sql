-- GitHub App user tokens are encrypted by the Worker before being stored.
CREATE TABLE IF NOT EXISTS github_connections (
  user_key TEXT PRIMARY KEY,
  github_login TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
