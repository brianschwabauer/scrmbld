import { redirect } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { friendship, user } from '$lib/server/schema';
import { eq, or, and } from 'drizzle-orm';
import { notifyFriendRequest, notifyFriendAccepted } from '$lib/server/notifications';

interface LeaderboardEntry {
	userId: string;
	name: string | null;
	username: string | null;
	avgTime: number | null;
	gamesPlayed: number;
	streak: number;
}

/**
 * Get week boundaries (Monday 00:00 to Sunday 23:59:59) in the user's timezone.
 * Returns UTC timestamps that correspond to those local times.
 */
function getWeekBoundariesForTimezone(timezone: string): { weekStart: number; weekEnd: number } {
	const now = new Date();

	try {
		// Get current date components in the specified timezone
		const options = { timeZone: timezone };
		const localYear = parseInt(
			new Intl.DateTimeFormat('en-US', { ...options, year: 'numeric' }).format(now),
		);
		const localMonth =
			parseInt(new Intl.DateTimeFormat('en-US', { ...options, month: 'numeric' }).format(now)) - 1;
		const localDay = parseInt(
			new Intl.DateTimeFormat('en-US', { ...options, day: 'numeric' }).format(now),
		);
		const localWeekday = new Intl.DateTimeFormat('en-US', { ...options, weekday: 'short' }).format(
			now,
		);

		// Calculate days since Monday (Monday=0, Sunday=6)
		const weekdayToNum: Record<string, number> = {
			Sun: 6,
			Mon: 0,
			Tue: 1,
			Wed: 2,
			Thu: 3,
			Fri: 4,
			Sat: 5,
		};
		const daysSinceMonday = weekdayToNum[localWeekday] ?? 0;

		// Calculate the Monday date (may be in previous month - Date.UTC handles this)
		const mondayDay = localDay - daysSinceMonday;

		// Get the timezone offset at Monday noon (to avoid DST boundary issues)
		const testUTC = Date.UTC(localYear, localMonth, mondayDay, 12, 0, 0);
		const testDate = new Date(testUTC);
		const localHour = parseInt(
			new Intl.DateTimeFormat('en-US', { ...options, hour: 'numeric', hour12: false }).format(
				testDate,
			),
		);
		const offsetHours = localHour - 12;

		// Monday 00:00 local in UTC
		const weekStart = Date.UTC(localYear, localMonth, mondayDay, 0, 0, 0) - offsetHours * 3600000;
		const weekEnd = weekStart + 7 * 86400000;

		return { weekStart, weekEnd };
	} catch {
		// Invalid timezone, fall back to UTC
		return getWeekBoundariesUTC();
	}
}

/**
 * Get week boundaries in UTC (fallback)
 */
function getWeekBoundariesUTC(): { weekStart: number; weekEnd: number } {
	const now = new Date();
	const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
	const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	const weekStart = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() - daysSinceMonday,
	);
	const weekEnd = weekStart + 7 * 86400000;
	return { weekStart, weekEnd };
}

/**
 * Get the user's timezone using the fallback chain:
 * 1. User's profile timezone preference
 * 2. IP-detected timezone from Cloudflare
 * 3. UTC as final fallback
 */
function getUserTimezone(
	userTimezone: string | null | undefined,
	cfTimezone: string | undefined,
): string {
	if (userTimezone) return userTimezone;
	if (cfTimezone) return cfTimezone;
	return 'UTC';
}

const SUGGESTIONS_PAGE_SIZE = 10;

export const load = async ({ request, platform, url }) => {
	if (!platform?.env?.D1)
		return {
			friends: [],
			leaderboard: [],
			weekLabel: '',
			suggestedFriends: [],
			hasMoreSuggestions: false,
		};

	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		throw redirect(302, '/signin');
	}
	if (!session.user.emailVerified) {
		throw redirect(302, '/verify-email');
	}

	// Pagination for suggestions
	const suggestionsPage = Math.max(0, parseInt(url.searchParams.get('suggestionsPage') || '0', 10));

	const db = createDb(platform.env.D1);
	const d1 = platform.env.D1;

	// Fetch friends
	const friends = await db
		.select({
			friendshipId: friendship.id,
			status: friendship.status,
			friendId: user.id,
			friendName: user.name,
			friendUsername: user.username,
			initiatorId: friendship.userId1,
		})
		.from(friendship)
		.innerJoin(
			user,
			or(
				and(eq(friendship.userId1, session.user.id), eq(friendship.userId2, user.id)),
				and(eq(friendship.userId2, session.user.id), eq(friendship.userId1, user.id)),
			),
		)
		.where(or(eq(friendship.userId1, session.user.id), eq(friendship.userId2, session.user.id)));

	// Get user's timezone using fallback chain
	const cfTimezone = platform?.cf?.timezone as string | undefined;
	const userTimezone = getUserTimezone(session.user.timezone, cfTimezone);

	// Calculate week boundaries in user's timezone (Monday start)
	const { weekStart, weekEnd } = getWeekBoundariesForTimezone(userTimezone);

	// Used later for streak calculation
	const now = new Date();

	// Get accepted friend IDs
	const acceptedFriendIds = friends.filter((f) => f.status === 'accepted').map((f) => f.friendId);

	// Include self in leaderboard
	const leaderboardUserIds = [session.user.id, ...acceptedFriendIds];

	let leaderboard: LeaderboardEntry[] = [];
	let weekLabel = '';

	if (leaderboardUserIds.length > 0) {
		// Query gameplay for this week for all leaderboard users
		const placeholders = leaderboardUserIds.map(() => '?').join(',');
		const weeklyGamesResult = await d1
			.prepare(
				`SELECT user_id, time, day FROM gameplay
				 WHERE user_id IN (${placeholders})
				 AND day >= ? AND day < ?
				 AND time IS NOT NULL`,
			)
			.bind(...leaderboardUserIds, weekStart, weekEnd)
			.all<{ user_id: string; time: number; day: number }>();

		// Query for streak data (last 100 days)
		const hundredDaysAgo = Date.now() - 100 * 86400000;
		const streakGamesResult = await d1
			.prepare(
				`SELECT user_id, day FROM gameplay
				 WHERE user_id IN (${placeholders})
				 AND day >= ?
				 AND time IS NOT NULL
				 ORDER BY day DESC`,
			)
			.bind(...leaderboardUserIds, hundredDaysAgo)
			.all<{ user_id: string; day: number }>();

		// Query user info for all leaderboard users
		const usersResult = await d1
			.prepare(`SELECT id, name, username FROM user WHERE id IN (${placeholders})`)
			.bind(...leaderboardUserIds)
			.all<{ id: string; name: string | null; username: string | null }>();

		const userMap = new Map(usersResult.results.map((u) => [u.id, u]));

		// Group weekly games by user
		// Note: gameplay.time is NUMERIC affinity in SQLite, D1 may return as string
		const weeklyByUser = new Map<string, number[]>();
		for (const game of weeklyGamesResult.results || []) {
			if (!weeklyByUser.has(game.user_id)) {
				weeklyByUser.set(game.user_id, []);
			}
			weeklyByUser.get(game.user_id)!.push(Number(game.time));
		}

		// Group streak games by user
		const streakByUser = new Map<string, number[]>();
		for (const game of streakGamesResult.results || []) {
			if (!streakByUser.has(game.user_id)) {
				streakByUser.set(game.user_id, []);
			}
			streakByUser.get(game.user_id)!.push(game.day);
		}

		// Calculate streak for each user
		const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
		const msPerDay = 86400000;

		function calculateStreak(days: number[]): number {
			if (!days.length) return 0;
			const sortedDays = [...new Set(days)].sort((a, b) => b - a);
			let streak = 0;
			// If the most recent game isn't today, start counting from yesterday
			const startDay = sortedDays[0] === today ? today : today - msPerDay;
			for (let i = 0; i < sortedDays.length; i++) {
				const expectedDay = startDay - msPerDay * i;
				if (sortedDays[i] === expectedDay) {
					streak++;
				} else {
					break;
				}
			}
			return streak;
		}

		// Build leaderboard entries
		leaderboard = leaderboardUserIds.map((userId) => {
			const userInfo = userMap.get(userId);
			const weeklyTimes = weeklyByUser.get(userId) || [];
			const streakDays = streakByUser.get(userId) || [];

			const avgTime =
				weeklyTimes.length > 0 ? weeklyTimes.reduce((a, b) => a + b, 0) / weeklyTimes.length : null;

			return {
				userId,
				name: userInfo?.name || null,
				username: userInfo?.username || null,
				avgTime,
				gamesPlayed: weeklyTimes.length,
				streak: calculateStreak(streakDays),
			};
		});

		// Sort by avg time ascending (null/no games at the end)
		leaderboard.sort((a, b) => {
			if (a.avgTime === null && b.avgTime === null) return 0;
			if (a.avgTime === null) return 1;
			if (b.avgTime === null) return -1;
			return a.avgTime - b.avgTime;
		});

		// Format week label using the user's timezone
		const weekStartDate = new Date(weekStart);
		const weekEndDate = new Date(weekEnd - msPerDay);
		const dateFormatOptions: Intl.DateTimeFormatOptions = {
			month: 'short',
			day: 'numeric',
			timeZone: userTimezone,
		};
		weekLabel = `${weekStartDate.toLocaleDateString('en-US', dateFormatOptions)} - ${weekEndDate.toLocaleDateString('en-US', dateFormatOptions)}`;
	}

	// Query suggested friends: public profiles with username, excluding self and existing friendships
	// Sorted by mutual friends count (friends-of-friends first)
	const suggestedFriendsResult = await d1
		.prepare(
			`SELECT
				u.id,
				u.name,
				u.username,
				(
					SELECT COUNT(*) FROM friendship f
					WHERE f.status = 'accepted'
					AND (
						(f.user_id_1 = u.id AND f.user_id_2 IN (
							SELECT CASE WHEN f2.user_id_1 = ? THEN f2.user_id_2 ELSE f2.user_id_1 END
							FROM friendship f2
							WHERE (f2.user_id_1 = ? OR f2.user_id_2 = ?) AND f2.status = 'accepted'
						))
						OR
						(f.user_id_2 = u.id AND f.user_id_1 IN (
							SELECT CASE WHEN f2.user_id_1 = ? THEN f2.user_id_2 ELSE f2.user_id_1 END
							FROM friendship f2
							WHERE (f2.user_id_1 = ? OR f2.user_id_2 = ?) AND f2.status = 'accepted'
						))
					)
				) as mutual_friends
			FROM user u
			WHERE
				u.profile_visibility = 'public'
				AND u.username IS NOT NULL
				AND u.id != ?
				AND NOT EXISTS (
					SELECT 1 FROM friendship f
					WHERE (f.user_id_1 = ? AND f.user_id_2 = u.id)
						OR (f.user_id_1 = u.id AND f.user_id_2 = ?)
				)
			ORDER BY mutual_friends DESC, u.username ASC
			LIMIT ? OFFSET ?`,
		)
		.bind(
			session.user.id,
			session.user.id,
			session.user.id, // For first mutual subquery
			session.user.id,
			session.user.id,
			session.user.id, // For second mutual subquery
			session.user.id, // Not me
			session.user.id,
			session.user.id, // Not existing friendship
			SUGGESTIONS_PAGE_SIZE + 1, // Fetch one extra to check if there's more
			suggestionsPage * SUGGESTIONS_PAGE_SIZE,
		)
		.all<{ id: string; name: string | null; username: string; mutual_friends: number }>();

	const suggestedFriends = (suggestedFriendsResult.results || []).slice(0, SUGGESTIONS_PAGE_SIZE);
	const hasMoreSuggestions = (suggestedFriendsResult.results || []).length > SUGGESTIONS_PAGE_SIZE;

	return {
		friends,
		userId: session.user.id,
		userName: session.user.name,
		userUsername: session.user.username,
		leaderboard,
		weekLabel,
		suggestedFriends,
		hasMoreSuggestions,
		suggestionsPage,
	};
};

export const actions = {
	sendFriendRequest: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const usernameInput = formData.get('username') as string;

		if (!usernameInput) return { success: false, error: 'Username required' };

		const db = createDb(platform.env.D1);

		// Find user by username
		const targetUser = await db.query.user.findFirst({
			where: eq(user.username, usernameInput.toLowerCase()),
		});

		if (!targetUser) return { success: false, error: 'User not found' };
		if (targetUser.id === session.user.id) return { success: false, error: 'Cannot add yourself' };

		// Check if friendship already exists
		const existing = await db.query.friendship.findFirst({
			where: or(
				and(eq(friendship.userId1, session.user.id), eq(friendship.userId2, targetUser.id)),
				and(eq(friendship.userId1, targetUser.id), eq(friendship.userId2, session.user.id)),
			),
		});

		if (existing)
			return { success: false, error: 'Friend request already exists or you are already friends.' };

		await db.insert(friendship).values({
			id: crypto.randomUUID(),
			userId1: session.user.id,
			userId2: targetUser.id,
			status: 'pending',
			createdAt: new Date(),
		});

		// Send push notification to the recipient (non-blocking)
		if (platform.env.VAPID_PUBLIC_KEY && platform.env.VAPID_PRIVATE_KEY) {
			notifyFriendRequest(targetUser.id, session.user.name || '', session.user.username, {
				d1: platform.env.D1,
				vapidPublicKey: platform.env.VAPID_PUBLIC_KEY,
				vapidPrivateKey: platform.env.VAPID_PRIVATE_KEY,
			}).catch((e) => console.error('Failed to send friend request notification:', e));
		}

		return { success: true, message: 'Friend request sent!' };
	},

	acceptFriend: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false };

		const formData = await request.formData();
		const friendshipId = formData.get('friendshipId') as string;

		const db = createDb(platform.env.D1);

		// Get the friendship to find the original sender
		const existingFriendship = await db.query.friendship.findFirst({
			where: and(eq(friendship.id, friendshipId), eq(friendship.userId2, session.user.id)),
		});

		if (!existingFriendship) return { success: false };

		await db.update(friendship).set({ status: 'accepted' }).where(eq(friendship.id, friendshipId));

		// Send push notification to the original sender (non-blocking)
		if (platform.env.VAPID_PUBLIC_KEY && platform.env.VAPID_PRIVATE_KEY) {
			notifyFriendAccepted(
				existingFriendship.userId1,
				session.user.name || '',
				session.user.username,
				{
					d1: platform.env.D1,
					vapidPublicKey: platform.env.VAPID_PUBLIC_KEY,
					vapidPrivateKey: platform.env.VAPID_PRIVATE_KEY,
				},
			).catch((e) => console.error('Failed to send friend accepted notification:', e));
		}

		return { success: true };
	},

	removeFriend: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false };

		const formData = await request.formData();
		const friendshipId = formData.get('friendshipId') as string;

		const db = createDb(platform.env.D1);
		await db
			.delete(friendship)
			.where(
				and(
					eq(friendship.id, friendshipId),
					or(eq(friendship.userId1, session.user.id), eq(friendship.userId2, session.user.id)),
				),
			);
		return { success: true };
	},

	sendRequestById: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const targetUserId = formData.get('userId') as string;

		if (!targetUserId) return { success: false, error: 'User ID required' };
		if (targetUserId === session.user.id) return { success: false, error: 'Cannot add yourself' };

		const db = createDb(platform.env.D1);

		// Verify target user exists
		const targetUser = await db.query.user.findFirst({
			where: eq(user.id, targetUserId),
		});

		if (!targetUser) return { success: false, error: 'User not found' };

		// Check if friendship already exists
		const existing = await db.query.friendship.findFirst({
			where: or(
				and(eq(friendship.userId1, session.user.id), eq(friendship.userId2, targetUserId)),
				and(eq(friendship.userId1, targetUserId), eq(friendship.userId2, session.user.id)),
			),
		});

		if (existing) return { success: false, error: 'Already friends or request pending' };

		await db.insert(friendship).values({
			id: crypto.randomUUID(),
			userId1: session.user.id,
			userId2: targetUserId,
			status: 'pending',
			createdAt: new Date(),
		});

		// Send push notification to the recipient (non-blocking)
		if (platform.env.VAPID_PUBLIC_KEY && platform.env.VAPID_PRIVATE_KEY) {
			notifyFriendRequest(targetUserId, session.user.name || '', session.user.username, {
				d1: platform.env.D1,
				vapidPublicKey: platform.env.VAPID_PUBLIC_KEY,
				vapidPrivateKey: platform.env.VAPID_PRIVATE_KEY,
			}).catch((e) => console.error('Failed to send friend request notification:', e));
		}

		return { success: true, sentToUserId: targetUserId };
	},

	loadMoreSuggestions: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { suggestions: [], hasMore: false, page: 0 };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { suggestions: [], hasMore: false, page: 0 };

		const formData = await request.formData();
		const page = Math.max(0, parseInt(formData.get('page') as string, 10) || 0);

		const d1 = platform.env.D1;

		const suggestedFriendsResult = await d1
			.prepare(
				`SELECT
					u.id,
					u.name,
					u.username,
					(
						SELECT COUNT(*) FROM friendship f
						WHERE f.status = 'accepted'
						AND (
							(f.user_id_1 = u.id AND f.user_id_2 IN (
								SELECT CASE WHEN f2.user_id_1 = ? THEN f2.user_id_2 ELSE f2.user_id_1 END
								FROM friendship f2
								WHERE (f2.user_id_1 = ? OR f2.user_id_2 = ?) AND f2.status = 'accepted'
							))
							OR
							(f.user_id_2 = u.id AND f.user_id_1 IN (
								SELECT CASE WHEN f2.user_id_1 = ? THEN f2.user_id_2 ELSE f2.user_id_1 END
								FROM friendship f2
								WHERE (f2.user_id_1 = ? OR f2.user_id_2 = ?) AND f2.status = 'accepted'
							))
						)
					) as mutual_friends
				FROM user u
				WHERE
					u.profile_visibility = 'public'
					AND u.username IS NOT NULL
					AND u.id != ?
					AND NOT EXISTS (
						SELECT 1 FROM friendship f
						WHERE (f.user_id_1 = ? AND f.user_id_2 = u.id)
							OR (f.user_id_1 = u.id AND f.user_id_2 = ?)
					)
				ORDER BY mutual_friends DESC, u.username ASC
				LIMIT ? OFFSET ?`,
			)
			.bind(
				session.user.id,
				session.user.id,
				session.user.id,
				session.user.id,
				session.user.id,
				session.user.id,
				session.user.id,
				session.user.id,
				session.user.id,
				SUGGESTIONS_PAGE_SIZE + 1,
				page * SUGGESTIONS_PAGE_SIZE,
			)
			.all<{ id: string; name: string | null; username: string; mutual_friends: number }>();

		const suggestions = (suggestedFriendsResult.results || []).slice(0, SUGGESTIONS_PAGE_SIZE);
		const hasMore = (suggestedFriendsResult.results || []).length > SUGGESTIONS_PAGE_SIZE;

		return { suggestions, hasMore, page };
	},
};
