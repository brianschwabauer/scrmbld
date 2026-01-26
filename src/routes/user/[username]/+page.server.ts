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
		isSignedIn: !!session,
		friendshipStatus,
		friendshipId,
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

		// Only allow accepting if you're the recipient (userId2)
		await db
			.update(friendship)
			.set({ status: 'accepted' })
			.where(and(eq(friendship.id, friendshipId), eq(friendship.userId2, session.user.id)));

		return { success: true };
	},
};
