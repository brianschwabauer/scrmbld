-- Migration number: 0003 	 2024-05-22T01:00:00.000Z

-- User Table
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    username TEXT UNIQUE,
    profile_visibility TEXT DEFAULT 'public'
);

-- Session Table
CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

-- Account Table
CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

-- Verification Table
CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
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
