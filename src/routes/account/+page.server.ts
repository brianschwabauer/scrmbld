import { redirect } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { friendship, gameplay, user } from '$lib/server/schema';
import { eq, or, and, isNull } from 'drizzle-orm';

export const load = async ({ request, platform }) => {
	if (!platform?.env?.D1) return {};

	const auth = initAuth(platform.env.D1, platform.env);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		throw redirect(302, '/signin');
	}

	const db = createDb(platform.env.D1);

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

	return {
		user: session.user,
		friends,
	};
};

export const actions = {
	claimHistory: async ({ cookies, platform, request }) => {
		if (!platform?.env?.D1) return { success: false, error: 'Database unavailable' };

		const auth = initAuth(platform.env.D1, platform.env);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const anonUuid = cookies.get('scrmbld_user_uuid');
		if (!anonUuid) {
			return { success: false, message: 'No anonymous history found on this device.' };
		}

		const db = createDb(platform.env.D1);

		// Update gameplay rows where user_uuid matches and user_id is NULL
		const result = await db
			.update(gameplay)
			.set({ userId: session.user.id })
			.where(and(eq(gameplay.userUuid, anonUuid), isNull(gameplay.userId)))
			.returning({ id: gameplay.id });

		return {
			success: true,
			count: result.length,
			message: `Successfully imported ${result.length} games.`,
		};
	},

	sendFriendRequest: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1, platform.env);
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

		// Check verification existence
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

		// TODO: Send email notification to targetUser logic here

		return { success: true, message: 'Friend request sent!' };
	},

	acceptFriend: async ({ request, platform }) => {
		// Logic to accept friend request
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1, platform.env);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false };

		const formData = await request.formData();
		const friendshipId = formData.get('friendshipId') as string;

		const db = createDb(platform.env.D1);
		await db
			.update(friendship)
			.set({ status: 'accepted' })
			.where(
				and(
					eq(friendship.id, friendshipId),
					eq(friendship.userId2, session.user.id), // Only recipient can accept
				),
			);

		return { success: true };
	},

	removeFriend: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1, platform.env);
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

	updateProfile: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1, platform.env);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const profile = formData.get('profile') as string;
		const showName = formData.get('showName') === 'on';
		const name = formData.get('name') as string;

		const db = createDb(platform.env.D1);

		await db
			.update(user)
			.set({
				name,
				privacySettings: JSON.stringify({ profile, show_name: showName }),
			})
			.where(eq(user.id, session.user.id));

		return { success: true, message: 'Profile updated' };
	},
};
