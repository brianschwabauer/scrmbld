import { error } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { user, friendship, gameplay, achievement } from '$lib/server/schema';
import { eq, and, or, sql, isNotNull, desc, count } from 'drizzle-orm';
import { notifyFriendRequest, notifyFriendAccepted } from '$lib/server/notifications';

export const load = async ({ params, platform, request }) => {
	if (!platform?.env?.D1) throw error(500, 'Database unavailable');
	const db = createDb(platform.env.D1);

	const targetUsername = params.username.toLowerCase();

	let targetUser = await db.query.user.findFirst({
		where: eq(user.username, targetUsername),
	});

	if (!targetUser) {
		// Try finding by ID
		targetUser = await db.query.user.findFirst({
			where: eq(user.id, params.username),
		});
	}

	if (!targetUser) throw error(404, 'User not found');

	const profileVisibility = targetUser.profileVisibility || 'public';

	let isAllowed = false;
	let isSelf = false;

	// Check auth
	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({ headers: request.headers });

	if (session?.user?.id === targetUser.id) {
		isAllowed = true;
		isSelf = true;
	} else if (profileVisibility === 'public') {
		isAllowed = true;
	} else if (profileVisibility === 'friends' && session?.user?.id) {
		// Check friendship
		const f = await db.query.friendship.findFirst({
			where: and(
				or(
					and(eq(friendship.userId1, session.user.id), eq(friendship.userId2, targetUser.id)),
					and(eq(friendship.userId1, targetUser.id), eq(friendship.userId2, session.user.id)),
				),
				eq(friendship.status, 'accepted'),
			),
		});
		if (f) isAllowed = true;
	}

	if (!isAllowed) {
		throw error(403, 'This profile is private.');
	}

	// Fetch Stats
	// 1. Average Time
	const avgResult = await db
		.select({
			value: sql<number>`avg(${gameplay.time})`,
		})
		.from(gameplay)
		.where(and(eq(gameplay.userId, targetUser.id), isNotNull(gameplay.time)));

	const averageTime = avgResult[0]?.value || 0;

	// 2. Wins this month
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

	const winsMonthResult = await db
		.select({
			count: sql<number>`count(*)`,
		})
		.from(gameplay)
		.where(
			and(
				eq(gameplay.userId, targetUser.id),
				isNotNull(gameplay.time),
				sql`${gameplay.startedAt} >= ${startOfMonth}`,
			),
		);

	const winsThisMonth = winsMonthResult[0]?.count || 0;

	// 3. Win History (for chart)
	const history = await db
		.select({
			day: gameplay.day,
			time: gameplay.time,
			date: gameplay.startedAt,
		})
		.from(gameplay)
		.where(and(eq(gameplay.userId, targetUser.id), isNotNull(gameplay.time)))
		.orderBy(gameplay.day);

	// 4. Achievements
	const userAchievements = await db
		.select({
			achievementId: achievement.achievementId,
			unlockedAt: achievement.unlockedAt,
		})
		.from(achievement)
		.where(eq(achievement.userId, targetUser.id))
		.orderBy(desc(achievement.unlockedAt));

	// Check friendship status if signed in and viewing someone else's profile
	let friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
	let friendshipId: string | null = null;

	if (session?.user?.id && !isSelf) {
		const existingFriendship = await db.query.friendship.findFirst({
			where: or(
				and(eq(friendship.userId1, session.user.id), eq(friendship.userId2, targetUser.id)),
				and(eq(friendship.userId1, targetUser.id), eq(friendship.userId2, session.user.id)),
			),
		});

		if (existingFriendship) {
			friendshipId = existingFriendship.id;
			if (existingFriendship.status === 'accepted') {
				friendshipStatus = 'accepted';
			} else if (existingFriendship.userId1 === session.user.id) {
				friendshipStatus = 'pending_sent';
			} else {
				friendshipStatus = 'pending_received';
			}
		}
	}

	// Personal stats - only computed for self
	let personalStats: {
		recentGames: { day: number; time: number }[];
		hintBreakdown: { noHints: number; oneHint: number; twoPlus: number };
		weekdayAvg: { day: number; avgTime: number; count: number }[];
		personalBests: {
			fastestTime: number | null;
			longestStreak: number;
			bestMonth: { month: string; count: number } | null;
		};
		percentile: number | null;
	} | null = null;

	if (isSelf && history.length >= 5) {
		const d1 = platform.env.D1;
		const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

		// 1. Recent games for trend chart (last 90 days)
		const recentGamesResult = await d1
			.prepare(
				`SELECT day, time FROM gameplay
				 WHERE user_id = ? AND time IS NOT NULL AND day >= ?
				 ORDER BY day ASC`,
			)
			.bind(targetUser.id, ninetyDaysAgo)
			.all<{ day: number; time: number }>();

		// Coerce time to number — gameplay.time is NUMERIC affinity, D1 may return as string
		const recentGames = (recentGamesResult.results || []).map((g) => ({
			day: g.day,
			time: Number(g.time),
		}));

		// 2. Hint breakdown
		const hintResult = await d1
			.prepare(
				`SELECT
					SUM(CASE WHEN num_hints = 0 OR num_hints IS NULL THEN 1 ELSE 0 END) as no_hints,
					SUM(CASE WHEN num_hints = 1 THEN 1 ELSE 0 END) as one_hint,
					SUM(CASE WHEN num_hints >= 2 THEN 1 ELSE 0 END) as two_plus
				 FROM gameplay WHERE user_id = ? AND time IS NOT NULL`,
			)
			.bind(targetUser.id)
			.first<{ no_hints: number; one_hint: number; two_plus: number }>();

		const hintBreakdown = {
			noHints: hintResult?.no_hints || 0,
			oneHint: hintResult?.one_hint || 0,
			twoPlus: hintResult?.two_plus || 0,
		};

		// 3. Weekday performance
		const weekdayResult = await d1
			.prepare(
				`SELECT
					CAST(strftime('%w', day / 1000, 'unixepoch') AS INTEGER) as weekday,
					AVG(time) as avg_time,
					COUNT(*) as count
				 FROM gameplay WHERE user_id = ? AND time IS NOT NULL
				 GROUP BY weekday`,
			)
			.bind(targetUser.id)
			.all<{ weekday: number; avg_time: number; count: number }>();

		const weekdayAvg = (weekdayResult.results || []).map((r) => ({
			day: r.weekday,
			avgTime: Number(r.avg_time),
			count: r.count,
		}));

		// 4. Personal bests
		// Fastest time
		const fastestResult = await d1
			.prepare(`SELECT MIN(time) as fastest FROM gameplay WHERE user_id = ? AND time IS NOT NULL`)
			.bind(targetUser.id)
			.first<{ fastest: number | null }>();

		// Longest streak - need to calculate from history
		const sortedDays = [...history].map((h) => h.day).sort((a, b) => Number(b) - Number(a));
		let longestStreak = 0;
		let currentStreak = 1;
		const msPerDay = 86400000;

		for (let i = 1; i < sortedDays.length; i++) {
			if (Number(sortedDays[i - 1]) - Number(sortedDays[i]) === msPerDay) {
				currentStreak++;
				longestStreak = Math.max(longestStreak, currentStreak);
			} else {
				currentStreak = 1;
			}
		}
		longestStreak = Math.max(longestStreak, currentStreak);

		// Best month
		const monthResult = await d1
			.prepare(
				`SELECT
					strftime('%Y-%m', started_at / 1000, 'unixepoch') as month,
					COUNT(*) as count
				 FROM gameplay WHERE user_id = ? AND time IS NOT NULL
				 GROUP BY month
				 ORDER BY count DESC
				 LIMIT 1`,
			)
			.bind(targetUser.id)
			.first<{ month: string; count: number }>();

		// 5. Percentile calculation
		let percentile: number | null = null;
		if (averageTime > 0) {
			const percentileResult = await d1
				.prepare(
					`SELECT COUNT(DISTINCT user_id) as slower_count
					 FROM gameplay
					 WHERE user_id IS NOT NULL AND time IS NOT NULL
					 GROUP BY user_id
					 HAVING AVG(time) > ?`,
				)
				.bind(averageTime)
				.all<{ slower_count: number }>();

			const totalPlayersResult = await d1
				.prepare(
					`SELECT COUNT(DISTINCT user_id) as total FROM gameplay WHERE user_id IS NOT NULL AND time IS NOT NULL`,
				)
				.all<{ total: number }>();

			const slowerCount = percentileResult.results?.length || 0;
			const totalPlayers = totalPlayersResult.results?.[0]?.total || 0;

			if (totalPlayers > 0) {
				percentile = Math.round((slowerCount / totalPlayers) * 100);
			}
		}

		personalStats = {
			recentGames,
			hintBreakdown,
			weekdayAvg,
			personalBests: {
				fastestTime: fastestResult?.fastest != null ? Number(fastestResult.fastest) : null,
				longestStreak,
				bestMonth: monthResult || null,
			},
			percentile,
		};
	}

	return {
		profileUser: {
			id: targetUser.id,
			username: targetUser.username,
			name: targetUser.name || null,
			isSelf,
		},
		stats: {
			averageTime,
			winsThisMonth,
			history,
		},
		achievements: userAchievements,
		isSignedIn: !!session,
		friendshipStatus,
		friendshipId,
		personalStats,
	};
};

export const actions = {
	addFriend: async ({ request, platform, params }) => {
		if (!platform?.env?.D1) return { success: false, error: 'Database unavailable' };

		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'You must be signed in' };

		const db = createDb(platform.env.D1);
		const targetUsername = params.username.toLowerCase();

		// Find target user
		let targetUser = await db.query.user.findFirst({
			where: eq(user.username, targetUsername),
		});

		if (!targetUser) {
			targetUser = await db.query.user.findFirst({
				where: eq(user.id, params.username),
			});
		}

		if (!targetUser) return { success: false, error: 'User not found' };
		if (targetUser.id === session.user.id) return { success: false, error: 'Cannot add yourself' };

		// Check if friendship already exists
		const existing = await db.query.friendship.findFirst({
			where: or(
				and(eq(friendship.userId1, session.user.id), eq(friendship.userId2, targetUser.id)),
				and(eq(friendship.userId1, targetUser.id), eq(friendship.userId2, session.user.id)),
			),
		});

		if (existing) {
			return { success: false, error: 'Friend request already exists' };
		}

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

		return { success: true };
	},

	cancelRequest: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false, error: 'Database unavailable' };

		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const friendshipId = formData.get('friendshipId') as string;

		const db = createDb(platform.env.D1);

		// Only allow canceling if you're the sender (userId1)
		await db
			.delete(friendship)
			.where(and(eq(friendship.id, friendshipId), eq(friendship.userId1, session.user.id)));

		return { success: true };
	},

	acceptFriend: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false, error: 'Database unavailable' };

		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const friendshipId = formData.get('friendshipId') as string;

		const db = createDb(platform.env.D1);

		// Get the friendship to find the original sender
		const existingFriendship = await db.query.friendship.findFirst({
			where: and(eq(friendship.id, friendshipId), eq(friendship.userId2, session.user.id)),
		});

		if (!existingFriendship) return { success: false, error: 'Friend request not found' };

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
};
