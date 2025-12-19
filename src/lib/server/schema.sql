DROP TABLE IF EXISTS gameplay;
CREATE TABLE IF NOT EXISTS gameplay (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT NOT NULL,
	word TEXT NOT NULL,
	day INTEGER NOT NULL,
	user_uuid TEXT NOT NULL,
	started_at INTEGER NOT NULL,
	ended_at INTEGER,
	time NUMERIC,
	json TEXT,
	ip TEXT,
	ip_city TEXT,
	ip_country TEXT,
	ip_latitude TEXT,
	ip_longitude TEXT,
	ip_region TEXT,
	ip_timezone TEXT,
	ua TEXT,
	ua_browser TEXT,
	ua_os TEXT,
	ua_device TEXT
);