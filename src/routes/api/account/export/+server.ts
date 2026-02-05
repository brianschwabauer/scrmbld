import { error } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { user, gameplay, friendship, achievement } from '$lib/server/schema';
import { eq, or } from 'drizzle-orm';

export async function GET({ request, platform }) {
	const d1 = platform?.env?.D1;
	if (!d1) throw error(500, 'Database not available');

	const auth = initAuth(d1);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Unauthorized');

	const db = createDb(d1);
	const userId = session.user.id;

	// Fetch all user data in parallel
	const [userData, games, friends, achievements] = await Promise.all([
		db.query.user.findFirst({ where: eq(user.id, userId) }),
		db.select().from(gameplay).where(eq(gameplay.userId, userId)),
		db
			.select({
				id: friendship.id,
				status: friendship.status,
				createdAt: friendship.createdAt,
				userId1: friendship.userId1,
				userId2: friendship.userId2,
			})
			.from(friendship)
			.where(or(eq(friendship.userId1, userId), eq(friendship.userId2, userId))),
		db
			.select({
				achievementId: achievement.achievementId,
				unlockedAt: achievement.unlockedAt,
			})
			.from(achievement)
			.where(eq(achievement.userId, userId)),
	]);

	const exportData = {
		exportedAt: new Date().toISOString(),
		profile: userData
			? {
					id: userData.id,
					email: userData.email,
					name: userData.name,
					username: userData.username,
					profileVisibility: userData.profileVisibility,
					emailVerified: userData.emailVerified,
					createdAt: userData.createdAt,
					updatedAt: userData.updatedAt,
				}
			: null,
		gameplay: games.map((g) => ({
			uuid: g.uuid,
			word: g.word,
			day: g.day,
			startedAt: g.startedAt,
			endedAt: g.endedAt,
			time: g.time,
			numHints: g.numHints,
		})),
		friendships: friends.map((f) => ({
			id: f.id,
			status: f.status,
			createdAt: f.createdAt,
			isSender: f.userId1 === userId,
		})),
		achievements: achievements.map((a) => ({
			achievementId: a.achievementId,
			unlockedAt: a.unlockedAt,
		})),
	};

	const dateStr = new Date().toISOString().slice(0, 10);

	return new Response(JSON.stringify(exportData, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="scrmbld-export-${dateStr}.json"`,
		},
	});
}
