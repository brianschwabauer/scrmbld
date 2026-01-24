import { error } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { user, friendship, gameplay } from '$lib/server/schema';
import { eq, and, or, sql, isNotNull } from 'drizzle-orm';

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

	const settings = targetUser.privacySettings
		? JSON.parse(targetUser.privacySettings)
		: { profile: 'public', show_name: false };

	let isAllowed = false;
	let isSelf = false;

	// Check auth
	const auth = initAuth(platform.env.D1, platform.env);
	const session = await auth.api.getSession({ headers: request.headers });

	if (session?.user?.id === targetUser.id) {
		isAllowed = true;
		isSelf = true;
	} else if (settings.profile === 'public') {
		isAllowed = true;
	} else if (settings.profile === 'friends' && session?.user?.id) {
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

	return {
		profileUser: {
			username: targetUser.username,
			name: targetUser.name || null,
			isSelf,
		},
		stats: {
			averageTime,
			winsThisMonth,
			history,
		},
	};
};
