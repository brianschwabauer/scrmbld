import { sqliteTable, text, integer, numeric } from 'drizzle-orm/sqlite-core';

// Auth Tables

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	username: text('username').unique(),
	profileVisibility: text('profile_visibility').default('public'),
	timezone: text('timezone'), // IANA timezone (e.g., "America/New_York")
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// App Tables

export const friendship = sqliteTable('friendship', {
	id: text('id').primaryKey(),
	userId1: text('user_id_1')
		.notNull()
		.references(() => user.id),
	userId2: text('user_id_2')
		.notNull()
		.references(() => user.id),
	status: text('status').notNull(), // pending, accepted
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const gameplay = sqliteTable('gameplay', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	uuid: text('uuid').notNull(),
	word: text('word').notNull(),
	userUuid: text('user_uuid').notNull(), // The anonymous cookie id
	userId: text('user_id').references(() => user.id), // The real user id (nullable)
	day: integer('day').notNull(),
	startedAt: integer('started_at').notNull(),
	endedAt: integer('ended_at'),
	time: numeric('time'),
	numHints: integer('num_hints'),
	json: text('json'),
});

// Achievement table for user badges
export const achievement = sqliteTable('achievement', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	achievementId: text('achievement_id').notNull(),
	unlockedAt: integer('unlocked_at', { mode: 'timestamp' }).notNull(),
});

// Push notification subscriptions
export const pushSubscription = sqliteTable('push_subscription', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	endpoint: text('endpoint').notNull(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	timezone: text('timezone'),
	notifyDailyReminder: integer('notify_daily_reminder').notNull().default(1),
	notifyFriendActivity: integer('notify_friend_activity').notNull().default(1),
	notifyWeeklyRecap: integer('notify_weekly_recap').notNull().default(1),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
