import { eq, and, isNotNull, count } from 'drizzle-orm';
import { achievement, gameplay } from './schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './schema';

interface AchievementContext {
	time: number; // solve time in ms
	numHints: number;
	streak: number; // current streak after this game
	totalGames: number; // total completed games
	hour: number; // local hour when game was completed (in user's timezone)
}

/**
 * Get the current hour in a specific timezone (0-23)
 */
function getHourInTimezone(date: Date, timezone: string | undefined): number {
	if (!timezone) {
		return date.getUTCHours();
	}
	try {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			hour: 'numeric',
			hourCycle: 'h23',
		});
		return parseInt(formatter.format(date), 10);
	} catch {
		// Invalid timezone, fall back to UTC
		return date.getUTCHours();
	}
}

// Achievement check functions - these determine if an achievement should be awarded
const ACHIEVEMENT_CHECKS: Record<string, (ctx: AchievementContext) => boolean> = {
	speed_demon: (ctx) => ctx.time < 30000,
	lightning: (ctx) => ctx.time < 15000,
	no_hints: (ctx) => ctx.numHints === 0,
	streak_7: (ctx) => ctx.streak >= 7,
	streak_30: (ctx) => ctx.streak >= 30,
	streak_100: (ctx) => ctx.streak >= 100,
	early_bird: (ctx) => ctx.hour < 6,
	dedicated_50: (ctx) => ctx.totalGames >= 50,
	veteran_200: (ctx) => ctx.totalGames >= 200,
};

export async function checkAndAwardAchievements(
	db: DrizzleD1Database<typeof schema>,
	userId: string,
	gameData: { time: number; numHints: number; day: number; timezone?: string },
): Promise<string[]> {
	// 1. Get existing achievements for this user
	const existingAchievements = await db
		.select({ achievementId: achievement.achievementId })
		.from(achievement)
		.where(eq(achievement.userId, userId));
	const existingIds = new Set(existingAchievements.map((a) => a.achievementId));

	// 2. Calculate streak - get recent games ordered by day descending
	const recentGames = await db
		.select({ day: gameplay.day, time: gameplay.time })
		.from(gameplay)
		.where(and(eq(gameplay.userId, userId), isNotNull(gameplay.time)))
		.orderBy(gameplay.day);

	// Sort by day descending for streak calculation, deduplicating days
	// (a user might have multiple games on the same day)
	const sortedDays = [...new Set(recentGames.map((g) => g.day))].sort((a, b) => b - a);

	// Calculate streak - count consecutive days backward from the current game day
	let streak = 0;
	const msPerDay = 86400000;
	for (let i = 0; i < sortedDays.length; i++) {
		const expectedDay = gameData.day - msPerDay * i;
		if (sortedDays[i] === expectedDay) {
			streak++;
		} else {
			break;
		}
	}

	// 3. Get total games count
	const totalResult = await db
		.select({ count: count() })
		.from(gameplay)
		.where(and(eq(gameplay.userId, userId), isNotNull(gameplay.time)));
	const totalGames = totalResult[0]?.count || 0;

	// 4. Build context
	const context: AchievementContext = {
		time: gameData.time,
		numHints: gameData.numHints,
		streak,
		totalGames,
		hour: getHourInTimezone(new Date(), gameData.timezone),
	};

	// 5. Check each achievement and award new ones
	const newlyUnlocked: string[] = [];

	for (const [achievementId, checkFn] of Object.entries(ACHIEVEMENT_CHECKS)) {
		if (!existingIds.has(achievementId) && checkFn(context)) {
			try {
				await db.insert(achievement).values({
					id: crypto.randomUUID(),
					userId,
					achievementId,
					unlockedAt: new Date(),
				});
				newlyUnlocked.push(achievementId);
			} catch {
				// Ignore duplicate key errors (race condition protection)
			}
		}
	}

	return newlyUnlocked;
}
