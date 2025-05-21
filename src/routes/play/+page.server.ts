import { getDailyWord } from '$lib/server/daily-word.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const { today, tomorrow, yesterday } = getDailyWord();
	if (!cookies.get('scrmbld_user_uuid')) {
		cookies.set('scrmbld_user_uuid', crypto.randomUUID(), { path: '/' });
	}

	let averageTime: number | null = null;

	try {
		const D1 = platform?.env?.D1;
		if (!D1) {
			console.error('D1 database instance is not available');
		} else {
			const sevenDaysAgoTimestamp = today.day - 7 * 86400000; // 7 days in milliseconds
			const query =
				'SELECT AVG(time) as avg_time FROM gameplay WHERE word = ?1 AND day < ?2 AND day >= ?3 AND time IS NOT NULL';
			const result = await D1.prepare(query)
				.bind(today.word, today.day, sevenDaysAgoTimestamp)
				.first<{ avg_time: number | null }>();
			averageTime = result?.avg_time ?? null;
		}
	} catch (error) {
		console.error('Error fetching average time:', error);
		// Optionally, handle the error e.g., by setting a default or logging
	}

	return {
		words: [
			{ day: yesterday.day, word: [yesterday.word, ...yesterday.extraLetters] },
			{ day: today.day, word: [today.word, ...today.extraLetters] },
			{ day: tomorrow.day, word: [tomorrow.word, ...tomorrow.extraLetters] }
		],
		averageTime
	};
};
