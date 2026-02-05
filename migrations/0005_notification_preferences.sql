-- Add granular notification preferences to push_subscription table
ALTER TABLE push_subscription ADD COLUMN notify_daily_reminder INTEGER NOT NULL DEFAULT 1;
ALTER TABLE push_subscription ADD COLUMN notify_friend_activity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE push_subscription ADD COLUMN notify_weekly_recap INTEGER NOT NULL DEFAULT 1;
