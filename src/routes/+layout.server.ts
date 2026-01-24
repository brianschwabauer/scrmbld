import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { gameplay } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';

export const load = async ({ request, platform, cookies }) => {
	if (!platform?.env?.D1) return { session: null, todayGameplayId: null };

	const auth = initAuth(platform.env.D1, platform.env);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) return { session: null, todayGameplayId: null };

	// Check if user has played today's game
	const db = createDb(platform.env.D1);
	const now = new Date();
	const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

	// Check by user ID first (for signed in users with linked history)
	let todayGame = await db.query.gameplay.findFirst({
		where: and(eq(gameplay.userId, session.user.id), eq(gameplay.day, todayStart)),
	});

	// If not found by userId, check by cookie UUID
	if (!todayGame) {
		const userUuid = cookies.get('scrmbld_user_uuid');
		if (userUuid) {
			todayGame = await db.query.gameplay.findFirst({
				where: and(eq(gameplay.userUuid, userUuid), eq(gameplay.day, todayStart)),
			});
		}
	}

	return {
		session: {
			user: {
				id: session.user.id,
				username: session.user.username,
				name: session.user.name,
			},
		},
		todayGameplayId: todayGame?.endedAt ? todayGame.uuid : null,
	};
};
