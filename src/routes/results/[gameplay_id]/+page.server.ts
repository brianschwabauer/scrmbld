import { error } from '@sveltejs/kit';
import type { GamePlay } from '../../api/gameplay/gameplay.type';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params, cookies }) => {
	const D1 = platform?.env?.D1;
	if (!D1) throw error(500, { message: 'Database not available' });

	const user_uuid = cookies.get('scrmbld_user_uuid');
	const gameplay = await D1.prepare(`SELECT * FROM gameplay WHERE uuid = ?`)
		.bind(params.gameplay_id)
		.first<GamePlay>();
	if (!gameplay?.time) {
		throw error(404, { message: 'Gameplay results not found' });
	}
	const [todaysResultsQuery, { avg_time: userWeeklyAverage }] = await Promise.all([
		D1.prepare(
			`SELECT * FROM gameplay WHERE day = ? AND time IS NOT NULL AND time >= 15000 AND time <= 600000 ORDER BY ended_at DESC LIMIT 200`,
		)
			.bind(gameplay.day)
			.all<GamePlay>(),
		D1.prepare(
			`SELECT AVG(time) as avg_time FROM gameplay WHERE user_uuid = ? AND day <= ? AND day >= ? AND time IS NOT NULL`,
		)
			.bind(gameplay.user_uuid, gameplay.day, gameplay.day - 7 * 86400000) // 7 days in milliseconds
			.first<{ avg_time: number }>()
			.then((res) => res || { avg_time: null }),
	]);
	if (!todaysResultsQuery.success) {
		throw error(500, { message: 'Failed to fetch results' });
	}
	const todaysResults = todaysResultsQuery.results;
	const averageForDay =
		todaysResults.reduce((acc, curr) => acc + Math.min(180000, curr.time || 0), 0) /
			todaysResults.length || 0;
	const STANDARD_DEVIATION_THRESHOLD = 1.5; // Number of standard deviations to filter by. Lower values include less results.
	const standardDeviation = Math.sqrt(
		todaysResults.reduce((acc, curr) => acc + Math.pow((curr.time || 0) - averageForDay, 2), 0) /
			todaysResults.length || 0,
	);
	const fastestTime = todaysResults
		.filter(
			(result) =>
				result.time &&
				result.time >= averageForDay - STANDARD_DEVIATION_THRESHOLD * standardDeviation &&
				result.time <= averageForDay + STANDARD_DEVIATION_THRESHOLD * standardDeviation,
		)
		.map((result) => result.time || 0)
		.reduce((min, curr) => (curr < min ? curr : min), gameplay.time || Infinity);

	return {
		day: gameplay.day,
		word: gameplay.word,
		time: gameplay.time,
		userWeeklyAverage,
		averageForDay,
		fastestTime,
		numHintsUsed: gameplay.num_hints || 0,
		isCurrentUser: user_uuid && user_uuid === gameplay.user_uuid,
	};
};
