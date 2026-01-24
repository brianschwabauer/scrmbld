-- Migration number: 0003 	 2024-05-22T01:00:00.000Z

-- User Table
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL,
    image TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    username TEXT UNIQUE,
    profile_visibility TEXT DEFAULT 'public'
);

-- Session Table
CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

-- Account Table
CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at INTEGER,
    refresh_token_expires_at INTEGER,
    scope TEXT,
    password TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Verification Table
CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
);

-- Friendships Table
CREATE TABLE IF NOT EXISTS friendship (
    id TEXT PRIMARY KEY,
    user_id_1 TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    user_id_2 TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('pending', 'accepted')),
    created_at INTEGER NOT NULL
);

-- Indexes for Friendships
CREATE INDEX IF NOT EXISTS idx_friendship_user_1 ON friendship(user_id_1);
CREATE INDEX IF NOT EXISTS idx_friendship_user_2 ON friendship(user_id_2);

-- Update Gameplay Table
ALTER TABLE gameplay ADD COLUMN user_id TEXT REFERENCES user(id);
CREATE INDEX IF NOT EXISTS idx_gameplay_user_id ON gameplay(user_id);
