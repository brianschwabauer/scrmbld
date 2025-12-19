-- Migration number: 0002 	 2025-12-19T16:49:40.694Z
CREATE TABLE IF NOT EXISTS newsletter_signup(
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  json TEXT,
  created_at INTEGER NOT NULL
);