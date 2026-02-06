/**
 * Notification Scheduler - Durable Object Worker
 *
 * Manages push notification scheduling with per-user timezone support.
 * Uses SQLite for persistent storage and alarms for scheduling.
 *
 * Exposes RPC methods via service binding for communication with the main app.
 */

import { WorkerEntrypoint, DurableObject } from 'cloudflare:workers';

export interface Env {
	NOTIFICATION_SCHEDULER: DurableObjectNamespace<NotificationScheduler>;
	VAPID_PUBLIC_KEY: string;
	VAPID_PRIVATE_KEY: string;
	D1: D1Database;
}

// Types for RPC method parameters
export interface SubscribeData {
	userId: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	timezone?: string;
}

// WorkerEntrypoint for service binding RPC calls
export default class NotificationsService extends WorkerEntrypoint<Env> {
	private getStub() {
		const id = this.env.NOTIFICATION_SCHEDULER.idFromName('main');
		return this.env.NOTIFICATION_SCHEDULER.get(id);
	}

	/** Subscribe a user to push notifications */
	async subscribe(data: SubscribeData): Promise<{ success: boolean }> {
		const stub = this.getStub();
		return stub.subscribe(data);
	}

	/** Unsubscribe a user from push notifications */
	async unsubscribe(userId: string): Promise<{ success: boolean }> {
		const stub = this.getStub();
		return stub.unsubscribe(userId);
	}

	/** Mark that a user has played today (skip daily reminder) */
	async played(userId: string, day: number): Promise<{ success: boolean }> {
		const stub = this.getStub();
		return stub.played(userId, day);
	}

	/** Get status/health info */
	async status(): Promise<{
		subscriptions: number;
		sentToday: number;
		nextAlarm: number | null;
		timezones: Record<string, number>;
	}> {
		const stub = this.getStub();
		return stub.status();
	}

	/** Manually trigger notifications (for testing) */
	async trigger(): Promise<{ success: boolean; message: string }> {
		const stub = this.getStub();
		return stub.trigger();
	}

	/** Initialize the hourly alarm */
	async initAlarm(): Promise<{ success: boolean; message: string }> {
		const stub = this.getStub();
		return stub.initAlarm();
	}

	/** Minimal fetch handler required for deployment — all access is via RPC */
	async fetch(): Promise<Response> {
		return new Response(null, { status: 404 });
	}
}

// Durable Object class
export class NotificationScheduler extends DurableObject<Env> {
	private sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;

		// Initialize database schema
		this.initDatabase();
	}

	private initDatabase() {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS subscriptions (
				user_id TEXT PRIMARY KEY,
				endpoint TEXT NOT NULL,
				p256dh TEXT NOT NULL,
				auth TEXT NOT NULL,
				timezone TEXT DEFAULT 'UTC',
				preferred_hour INTEGER DEFAULT 18,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS sent_today (
				user_id TEXT PRIMARY KEY,
				day INTEGER NOT NULL,
				sent_at INTEGER NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_subs_timezone ON subscriptions(timezone);
			CREATE INDEX IF NOT EXISTS idx_subs_hour ON subscriptions(preferred_hour);

			CREATE TABLE IF NOT EXISTS sent_weekly (
				timezone TEXT NOT NULL,
				week_key TEXT NOT NULL,
				sent_at INTEGER NOT NULL,
				PRIMARY KEY(timezone, week_key)
			);
		`);
	}

	// Called when alarm fires
	async alarm(): Promise<void> {
		console.log('Alarm fired, sending scheduled notifications');
		await this.sendScheduledNotifications();
		await this.scheduleNextAlarm();
	}

	private async scheduleNextAlarm(): Promise<void> {
		// Schedule alarm for the top of the next hour
		const now = new Date();
		const nextHour = new Date(now);
		nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

		await this.ctx.storage.setAlarm(nextHour.getTime());
		console.log(`Next alarm scheduled for ${nextHour.toISOString()}`);
	}

	// ===================
	// RPC Methods (public)
	// ===================

	/** Subscribe a user to push notifications */
	async subscribe(data: SubscribeData): Promise<{ success: boolean }> {
		if (!data.userId || !data.endpoint || !data.p256dh || !data.auth) {
			throw new Error('Missing required fields');
		}

		const now = Date.now();
		const timezone = data.timezone || 'UTC';
		const preferredHour = 18; // Default preferred hour

		this.sql.exec(
			`INSERT INTO subscriptions (user_id, endpoint, p256dh, auth, timezone, preferred_hour, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id) DO UPDATE SET
				endpoint = excluded.endpoint,
				p256dh = excluded.p256dh,
				auth = excluded.auth,
				timezone = excluded.timezone,
				preferred_hour = excluded.preferred_hour,
				updated_at = excluded.updated_at`,
			data.userId,
			data.endpoint,
			data.p256dh,
			data.auth,
			timezone,
			preferredHour,
			now,
			now,
		);

		// Ensure alarm is scheduled
		const currentAlarm = await this.ctx.storage.getAlarm();
		if (!currentAlarm) {
			await this.scheduleNextAlarm();
		}

		return { success: true };
	}

	/** Unsubscribe a user from push notifications */
	async unsubscribe(userId: string): Promise<{ success: boolean }> {
		if (!userId) {
			throw new Error('Missing userId');
		}

		this.sql.exec('DELETE FROM subscriptions WHERE user_id = ?', userId);
		this.sql.exec('DELETE FROM sent_today WHERE user_id = ?', userId);

		return { success: true };
	}

	/** Mark that a user has played today (skip daily reminder) */
	async played(userId: string, day: number): Promise<{ success: boolean }> {
		if (!userId || !day) {
			throw new Error('Missing required fields');
		}

		this.sql.exec(
			`INSERT INTO sent_today (user_id, day, sent_at) VALUES (?, ?, ?)
			 ON CONFLICT(user_id) DO UPDATE SET day = excluded.day, sent_at = excluded.sent_at`,
			userId,
			day,
			Date.now(),
		);

		return { success: true };
	}

	/** Get status/health info */
	async status(): Promise<{
		subscriptions: number;
		sentToday: number;
		nextAlarm: number | null;
		timezones: Record<string, number>;
	}> {
		const subscriptionCount = this.sql
			.exec('SELECT COUNT(*) as count FROM subscriptions')
			.one() as { count: number };
		const sentTodayCount = this.sql.exec('SELECT COUNT(*) as count FROM sent_today').one() as {
			count: number;
		};
		const currentAlarm = await this.ctx.storage.getAlarm();

		// Get timezone distribution
		const tzRows = this.sql
			.exec('SELECT timezone, COUNT(*) as count FROM subscriptions GROUP BY timezone')
			.toArray() as Array<{ timezone: string; count: number }>;
		const timezones: Record<string, number> = {};
		for (const row of tzRows) {
			timezones[row.timezone] = row.count;
		}

		return {
			subscriptions: subscriptionCount.count,
			sentToday: sentTodayCount.count,
			nextAlarm: currentAlarm,
			timezones,
		};
	}

	/** Manually trigger notifications (for testing) */
	async trigger(): Promise<{ success: boolean; message: string }> {
		await this.sendScheduledNotifications();
		return { success: true, message: 'Notifications triggered' };
	}

	/** Initialize the hourly alarm */
	async initAlarm(): Promise<{ success: boolean; message: string }> {
		await this.scheduleNextAlarm();
		return { success: true, message: 'Alarm initialized' };
	}

	private async sendScheduledNotifications(): Promise<void> {
		const now = new Date();

		// Get today's day timestamp (UTC midnight)
		const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

		// Clean up old sent_today entries (older than today)
		this.sql.exec('DELETE FROM sent_today WHERE day < ?', today);

		// Find users who:
		// 1. Have a subscription
		// 2. It's their preferred notification hour in their timezone
		// 3. Haven't been marked as "played" or "sent" today
		const usersToNotify = this.sql
			.exec(
				`
			SELECT s.user_id, s.endpoint, s.p256dh, s.auth, s.timezone, s.preferred_hour
			FROM subscriptions s
			LEFT JOIN sent_today st ON s.user_id = st.user_id AND st.day = ?
			WHERE st.user_id IS NULL
		`,
				today,
			)
			.toArray() as Array<{
			user_id: string;
			endpoint: string;
			p256dh: string;
			auth: string;
			timezone: string;
			preferred_hour: number;
		}>;

		console.log(`Checking ${usersToNotify.length} users for notifications`);

		// Filter by preferred hour first
		const eligibleUsers = usersToNotify.filter(
			(user) => this.getHourInTimezone(now, user.timezone) === user.preferred_hour,
		);

		// Check D1 preferences — filter out users who disabled daily reminders
		let dailyReminderUsers = eligibleUsers;
		if (eligibleUsers.length > 0) {
			const userIds = eligibleUsers.map((u) => u.user_id);
			const placeholders = userIds.map(() => '?').join(',');
			const prefResult = await this.env.D1.prepare(
				`SELECT user_id FROM push_subscription
				 WHERE user_id IN (${placeholders}) AND notify_daily_reminder = 0`,
			)
				.bind(...userIds)
				.all<{ user_id: string }>();

			const disabledUserIds = new Set((prefResult.results || []).map((r) => r.user_id));
			dailyReminderUsers = eligibleUsers.filter((u) => !disabledUserIds.has(u.user_id));
		}

		let sent = 0;
		const skipped = usersToNotify.length - dailyReminderUsers.length;
		let failed = 0;

		for (const user of dailyReminderUsers) {
			// Send notification
			try {
				const success = await this.sendPushNotification(user);
				if (success) {
					// Mark as sent
					this.sql.exec(
						'INSERT INTO sent_today (user_id, day, sent_at) VALUES (?, ?, ?)',
						user.user_id,
						today,
						Date.now(),
					);
					sent++;
				} else {
					failed++;
				}
			} catch (error) {
				console.error(`Failed to send notification to ${user.user_id}:`, error);
				failed++;
			}
		}

		console.log(`Notifications: sent=${sent}, skipped=${skipped}, failed=${failed}`);

		// Check weekly leaderboards (Monday 8AM per timezone)
		await this.checkWeeklyLeaderboards(now);
	}

	private getDayOfWeekInTimezone(date: Date, timezone: string): number {
		try {
			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				weekday: 'short',
			});
			const day = formatter.format(date);
			const dayMap: Record<string, number> = {
				Sun: 0,
				Mon: 1,
				Tue: 2,
				Wed: 3,
				Thu: 4,
				Fri: 5,
				Sat: 6,
			};
			return dayMap[day] ?? 0;
		} catch {
			return date.getUTCDay();
		}
	}

	/**
	 * Check weekly leaderboards and send notifications to winners.
	 * Runs on Monday 8AM per timezone. Awards one-time achievements
	 * and sends recurring weekly winner notifications.
	 */
	private async checkWeeklyLeaderboards(now: Date): Promise<void> {
		// Get distinct timezones from subscriptions
		const timezones = this.sql
			.exec('SELECT DISTINCT timezone FROM subscriptions')
			.toArray() as Array<{ timezone: string }>;

		for (const { timezone } of timezones) {
			const dayOfWeek = this.getDayOfWeekInTimezone(now, timezone);
			const hourInTz = this.getHourInTimezone(now, timezone);

			// Only process on Monday at 8AM
			if (dayOfWeek !== 1 || hourInTz !== 8) {
				continue;
			}

			// Compute week key for idempotency (the Monday we're currently on in this timezone)
			const weekKey = this.getDateStringInTimezone(now, timezone);

			// Check if already processed
			const existing = this.sql
				.exec('SELECT 1 FROM sent_weekly WHERE timezone = ? AND week_key = ?', timezone, weekKey)
				.toArray();

			if (existing.length > 0) {
				continue;
			}

			console.log(`Processing weekly leaderboard for timezone=${timezone}, week=${weekKey}`);

			try {
				await this.processWeeklyLeaderboardForTimezone(now, timezone);

				// Mark as processed only on success
				this.sql.exec(
					'INSERT INTO sent_weekly (timezone, week_key, sent_at) VALUES (?, ?, ?)',
					timezone,
					weekKey,
					Date.now(),
				);
			} catch (error) {
				console.error(`Failed to process weekly leaderboard for ${timezone}:`, error);
				// Don't mark as processed — will retry on next alarm
			}
		}

		// Clean up old sent_weekly entries (older than 14 days)
		const fourteenDaysAgo = Date.now() - 14 * 86400000;
		this.sql.exec('DELETE FROM sent_weekly WHERE sent_at < ?', fourteenDaysAgo);
	}

	private getDateStringInTimezone(date: Date, timezone: string): string {
		try {
			const formatter = new Intl.DateTimeFormat('en-CA', {
				timeZone: timezone,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
			});
			return formatter.format(date); // Returns YYYY-MM-DD
		} catch {
			return date.toISOString().slice(0, 10);
		}
	}

	private async processWeeklyLeaderboardForTimezone(now: Date, timezone: string): Promise<void> {
		const msPerDay = 86400000;

		// Calculate previous week boundaries (last Mon–Sun)
		// We know it's Monday 8AM in this timezone. Compute "today" in the timezone,
		// then derive the UTC epoch for that date. This avoids the bug where
		// Monday 8AM Asia/Tokyo = Sunday 11PM UTC, which would give wrong UTC day-of-week.
		const tzDateStr = this.getDateStringInTimezone(now, timezone); // e.g. "2026-02-02"
		const [year, month, day] = tzDateStr.split('-').map(Number);
		const thisMondayUtc = Date.UTC(year, month - 1, day); // UTC midnight of the timezone's Monday
		const lastMonday = thisMondayUtc - 7 * msPerDay;
		const lastSunday = thisMondayUtc; // exclusive upper bound

		// Get all subscribed users in this timezone
		const subscribers = this.sql
			.exec(
				'SELECT user_id, endpoint, p256dh, auth FROM subscriptions WHERE timezone = ?',
				timezone,
			)
			.toArray() as Array<{
			user_id: string;
			endpoint: string;
			p256dh: string;
			auth: string;
		}>;

		if (subscribers.length === 0) return;

		const subscriberIds = subscribers.map((s) => s.user_id);
		const subscriberMap = new Map(subscribers.map((s) => [s.user_id, s]));

		// Check D1 preferences — find users who disabled weekly recap notifications
		const weeklyRecapDisabledUsers = new Set<string>();
		if (subscriberIds.length > 0) {
			const prefPlaceholders = subscriberIds.map(() => '?').join(',');
			const prefResult = await this.env.D1.prepare(
				`SELECT user_id FROM push_subscription
				 WHERE user_id IN (${prefPlaceholders}) AND notify_weekly_recap = 0`,
			)
				.bind(...subscriberIds)
				.all<{ user_id: string }>();
			for (const r of prefResult.results || []) {
				weeklyRecapDisabledUsers.add(r.user_id);
			}
		}

		// Batch query D1 for friendships of all subscribers
		const friendPlaceholders = subscriberIds.map(() => '?').join(',');
		const friendships = await this.env.D1.prepare(
			`SELECT user_id_1, user_id_2 FROM friendship
			 WHERE (user_id_1 IN (${friendPlaceholders}) OR user_id_2 IN (${friendPlaceholders}))
			 AND status = 'accepted'`,
		)
			.bind(...subscriberIds, ...subscriberIds)
			.all<{ user_id_1: string; user_id_2: string }>();

		// Build friend map: userId → Set<friendId>
		const friendMap = new Map<string, Set<string>>();
		for (const f of friendships.results) {
			if (!friendMap.has(f.user_id_1)) friendMap.set(f.user_id_1, new Set());
			if (!friendMap.has(f.user_id_2)) friendMap.set(f.user_id_2, new Set());
			friendMap.get(f.user_id_1)!.add(f.user_id_2);
			friendMap.get(f.user_id_2)!.add(f.user_id_1);
		}

		// Collect all user IDs we need gameplay for (subscribers + their friends)
		const allRelevantUserIds = new Set<string>(subscriberIds);
		for (const [, friends] of friendMap) {
			for (const friendId of friends) {
				allRelevantUserIds.add(friendId);
			}
		}

		const allUserIds = [...allRelevantUserIds];
		if (allUserIds.length === 0) return;

		// Batch query D1 for gameplay in the previous week
		const gamePlaceholders = allUserIds.map(() => '?').join(',');
		const games = await this.env.D1.prepare(
			`SELECT user_id, time FROM gameplay
			 WHERE user_id IN (${gamePlaceholders})
			 AND day >= ? AND day < ?
			 AND time IS NOT NULL`,
		)
			.bind(...allUserIds, lastMonday, lastSunday)
			.all<{ user_id: string; time: number }>();

		// Build gameplay map: userId → number[] (times)
		// Note: gameplay.time is NUMERIC affinity in SQLite, which D1 may return as string
		const gameMap = new Map<string, number[]>();
		for (const g of games.results) {
			if (!gameMap.has(g.user_id)) gameMap.set(g.user_id, []);
			gameMap.get(g.user_id)!.push(Number(g.time));
		}

		let achievementsAwarded = 0;
		let notificationsSent = 0;

		for (const userId of subscriberIds) {
			const friends = friendMap.get(userId);
			if (!friends || friends.size === 0) continue;

			const userTimes = gameMap.get(userId);
			if (!userTimes || userTimes.length === 0) continue;

			// Get friends who also played that week
			const friendsWhoPlayed = [...friends].filter(
				(fId) => gameMap.has(fId) && gameMap.get(fId)!.length > 0,
			);
			if (friendsWhoPlayed.length === 0) continue;

			// Leaderboard King: best average time
			const userAvg = userTimes.reduce((a, b) => a + b, 0) / userTimes.length;
			let isLeaderboardKing = true;
			for (const friendId of friendsWhoPlayed) {
				const friendTimes = gameMap.get(friendId)!;
				const friendAvg = friendTimes.reduce((a, b) => a + b, 0) / friendTimes.length;
				if (friendAvg <= userAvg) {
					isLeaderboardKing = false;
					break;
				}
			}

			// Speed King: fastest single solve
			const userMin = Math.min(...userTimes);
			let isSpeedKing = true;
			for (const friendId of friendsWhoPlayed) {
				const friendMin = Math.min(...gameMap.get(friendId)!);
				if (friendMin <= userMin) {
					isSpeedKing = false;
					break;
				}
			}

			if (!isLeaderboardKing && !isSpeedKing) continue;

			// Award achievements (one-time, silent — duplicates ignored)
			// Use seconds (not ms) to match Drizzle's mode: 'timestamp' convention
			const nowSeconds = Math.floor(Date.now() / 1000);
			if (isLeaderboardKing) {
				try {
					await this.env.D1.prepare(
						'INSERT INTO achievement (id, user_id, achievement_id, unlocked_at) VALUES (?, ?, ?, ?)',
					)
						.bind(crypto.randomUUID(), userId, 'leaderboard_king', nowSeconds)
						.run();
					achievementsAwarded++;
				} catch {
					// UNIQUE constraint violation — already earned, ignore
				}
			}

			if (isSpeedKing) {
				try {
					await this.env.D1.prepare(
						'INSERT INTO achievement (id, user_id, achievement_id, unlocked_at) VALUES (?, ?, ?, ?)',
					)
						.bind(crypto.randomUUID(), userId, 'speed_king', nowSeconds)
						.run();
					achievementsAwarded++;
				} catch {
					// UNIQUE constraint violation — already earned, ignore
				}
			}

			// Send weekly winner notification (only if user hasn't disabled weekly recap)
			if (!weeklyRecapDisabledUsers.has(userId)) {
				let body: string;
				if (isLeaderboardKing && isSpeedKing) {
					body = 'You topped the leaderboard AND had the fastest solve last week!';
				} else if (isLeaderboardKing) {
					body = 'You had the best average time among friends last week!';
				} else {
					body = 'You had the fastest solve among friends last week!';
				}

				const sub = subscriberMap.get(userId)!;
				try {
					const success = await this.sendPushNotification(sub, {
						title: 'Weekly Recap \u{1F3C6}',
						body,
						url: '/friends',
						type: 'weekly_leaderboard',
					});
					if (success) notificationsSent++;
				} catch (error) {
					console.error(`Failed to send weekly notification to ${userId}:`, error);
				}
			}
		}

		console.log(
			`Weekly leaderboard for ${timezone}: achievements=${achievementsAwarded}, notifications=${notificationsSent}`,
		);
	}

	private getHourInTimezone(date: Date, timezone: string): number {
		try {
			// Use hourCycle: 'h23' to guarantee 0-23 range (hour12:false can return 24 for midnight)
			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				hour: 'numeric',
				hourCycle: 'h23',
			});
			const hourStr = formatter.format(date);
			return parseInt(hourStr, 10);
		} catch {
			// Invalid timezone, fall back to UTC
			return date.getUTCHours();
		}
	}

	private async sendPushNotification(
		user: {
			endpoint: string;
			p256dh: string;
			auth: string;
		},
		payloadObj?: { title: string; body: string; url: string; type: string },
	): Promise<boolean> {
		const payload = JSON.stringify(
			payloadObj || {
				title: 'SCRMBLD',
				body: "Today's puzzle is waiting!",
				url: '/play',
				type: 'daily_reminder',
			},
		);

		try {
			// Encrypt the payload
			const encrypted = await this.encryptPayload(payload, user.p256dh, user.auth);

			// Get audience from endpoint URL
			const endpointUrl = new URL(user.endpoint);
			const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

			// Create VAPID JWT
			const jwt = await this.createVapidJwt(audience);

			const response = await fetch(user.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					'Content-Encoding': 'aes128gcm',
					'Content-Length': encrypted.byteLength.toString(),
					TTL: '86400',
					Authorization: `vapid t=${jwt}, k=${this.env.VAPID_PUBLIC_KEY}`,
				},
				body: encrypted,
			});

			if (response.status === 410 || response.status === 404) {
				// Subscription expired, remove it
				console.log(`Subscription expired for endpoint, removing`);
				this.sql.exec('DELETE FROM subscriptions WHERE endpoint = ?', user.endpoint);
				return false;
			}

			return response.ok || response.status === 201;
		} catch (error) {
			console.error('Push notification error:', error);
			return false;
		}
	}

	private async encryptPayload(
		payload: string,
		p256dhBase64: string,
		authBase64: string,
	): Promise<ArrayBuffer> {
		// Generate local key pair for ECDH
		const localKeyPair = (await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			true,
			['deriveBits'],
		)) as CryptoKeyPair;

		// Export local public key
		const localPublicKeyRaw = (await crypto.subtle.exportKey(
			'raw',
			localKeyPair.publicKey,
		)) as ArrayBuffer;

		// Import subscriber's public key
		const p256dhBuffer = this.base64UrlToArrayBuffer(p256dhBase64);
		const subscriberPublicKey = await crypto.subtle.importKey(
			'raw',
			p256dhBuffer,
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			[],
		);

		// Derive shared secret via ECDH
		const sharedSecret = await crypto.subtle.deriveBits(
			{ name: 'ECDH', $public: subscriberPublicKey },
			localKeyPair.privateKey,
			256,
		);

		// Get auth secret
		const authSecret = this.base64UrlToArrayBuffer(authBase64);

		// Generate random content salt
		const salt = crypto.getRandomValues(new Uint8Array(16));

		// RFC 8291: Derive IKM using HKDF
		// IKM = ECDH shared secret, salt = auth secret
		// info = "WebPush: info\0" || subscriber_public_key (65 bytes) || local_public_key (65 bytes)
		const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
			'deriveBits',
		]);
		const ikmInfo = new Uint8Array(14 + p256dhBuffer.byteLength + localPublicKeyRaw.byteLength);
		const infoPrefix = new TextEncoder().encode('WebPush: info\0');
		ikmInfo.set(infoPrefix, 0);
		ikmInfo.set(new Uint8Array(p256dhBuffer), infoPrefix.length);
		ikmInfo.set(new Uint8Array(localPublicKeyRaw), infoPrefix.length + p256dhBuffer.byteLength);

		const prk = await crypto.subtle.deriveBits(
			{
				name: 'HKDF',
				hash: 'SHA-256',
				salt: new Uint8Array(authSecret),
				info: ikmInfo,
			},
			ikmKey,
			256,
		);

		// Derive content encryption key (CEK) — 16 bytes
		const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
		const cek = await crypto.subtle.deriveBits(
			{
				name: 'HKDF',
				hash: 'SHA-256',
				salt: salt,
				info: new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
			},
			prkKey,
			128,
		);

		// Derive nonce — 12 bytes (separate HKDF with different info)
		const nonceKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
		const nonce = await crypto.subtle.deriveBits(
			{
				name: 'HKDF',
				hash: 'SHA-256',
				salt: salt,
				info: new TextEncoder().encode('Content-Encoding: nonce\0'),
			},
			nonceKey,
			96,
		);

		// Encrypt payload
		const aesKey = await crypto.subtle.importKey('raw', new Uint8Array(cek), 'AES-GCM', false, [
			'encrypt',
		]);

		const payloadBytes = new TextEncoder().encode(payload);
		const paddedPayload = new Uint8Array(payloadBytes.length + 1);
		paddedPayload.set(payloadBytes);
		paddedPayload[payloadBytes.length] = 0x02; // Delimiter

		const ciphertext = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: new Uint8Array(nonce) },
			aesKey,
			paddedPayload,
		);

		// Build the encrypted message
		// Format: salt (16) + record size (4) + key length (1) + key + ciphertext
		const recordSize = 4096;
		const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.byteLength);
		header.set(salt, 0);
		new DataView(header.buffer).setUint32(16, recordSize, false);
		header[20] = localPublicKeyRaw.byteLength;
		header.set(new Uint8Array(localPublicKeyRaw), 21);

		const encrypted = new Uint8Array(header.length + ciphertext.byteLength);
		encrypted.set(header);
		encrypted.set(new Uint8Array(ciphertext), header.length);

		return encrypted.buffer;
	}

	private async createVapidJwt(audience: string): Promise<string> {
		const header = { typ: 'JWT', alg: 'ES256' };
		const now = Math.floor(Date.now() / 1000);
		const payload = {
			aud: audience,
			exp: now + 12 * 60 * 60, // 12 hours
			sub: 'mailto:notifications@scrmbld.app',
		};

		const headerB64 = this.arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
		const payloadB64 = this.arrayBufferToBase64Url(
			new TextEncoder().encode(JSON.stringify(payload)),
		);
		const unsignedToken = `${headerB64}.${payloadB64}`;

		// Import the private key
		const privateKeyRaw = this.base64UrlToArrayBuffer(this.env.VAPID_PRIVATE_KEY);
		const privateKey = await crypto.subtle.importKey(
			'pkcs8',
			privateKeyRaw,
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['sign'],
		);

		// Sign
		const signature = await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			privateKey,
			new TextEncoder().encode(unsignedToken),
		);

		return `${unsignedToken}.${this.arrayBufferToBase64Url(signature)}`;
	}

	private arrayBufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
		const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}

	private base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
		const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
		const padding = '='.repeat((4 - (base64.length % 4)) % 4);
		const binaryString = atob(base64 + padding);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}
}
