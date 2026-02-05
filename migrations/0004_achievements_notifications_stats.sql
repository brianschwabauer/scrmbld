-- Migration number: 0004    Features: Achievements, Push Notifications, Indexes

-- Achievement Table
CREATE TABLE IF NOT EXISTS achievement (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_achievement_user ON achievement(user_id);

-- Push Subscription Table
CREATE TABLE IF NOT EXISTS push_subscription (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    timezone TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscription(user_id);

-- Gameplay indexes for stats queries
CREATE INDEX IF NOT EXISTS idx_gameplay_day ON gameplay(day);
CREATE INDEX IF NOT EXISTS idx_gameplay_user_day ON gameplay(user_id, day);
