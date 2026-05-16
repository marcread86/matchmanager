-- Match Manager — cloud sync schema for Cloudflare D1
-- Run with: wrangler d1 execute matchmanager --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS user_state (
    email      TEXT PRIMARY KEY,
    state      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_state_updated
    ON user_state(updated_at);
