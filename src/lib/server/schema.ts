import { sqliteTable, text, integer, numeric } from 'drizzle-orm/sqlite-core';

// Auth Tables

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
	image: text('image'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
	username: text('username').unique(),
	privacySettings: text('privacy_settings'),
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: text('userId')
		.notNull()
		.references(() => user.id),
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }),
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
	userUuid: text('user_uuid').notNull(), // The anonymous cookie id
	userId: text('user_id').references(() => user.id), // The real user id (nullable)
	day: integer('day').notNull(),
	startedAt: integer('started_at').notNull(),
	endedAt: integer('ended_at'),
	time: numeric('time'),
	won: integer('won', { mode: 'boolean' }), // Assuming won is derived or stored
});
