-- Add device identification columns for multi-device push notification support
ALTER TABLE push_subscription ADD COLUMN device_name TEXT;
ALTER TABLE push_subscription ADD COLUMN device_id TEXT;
