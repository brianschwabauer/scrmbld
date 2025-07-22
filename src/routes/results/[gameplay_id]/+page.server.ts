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
	const [{ avg_time: averageForDay }, { min_time: fastestTime }, { avg_time: userWeeklyAverage }] =
		await Promise.all([
			D1.prepare(`SELECT AVG(time) as avg_time FROM gameplay WHERE day = ? AND time IS NOT NULL`)
				.bind(gameplay.day)
				.first<{ avg_time: number }>()
				.then((res) => res || { avg_time: null }),
			D1.prepare(`SELECT MIN(time) as min_time FROM gameplay WHERE day = ? AND time IS NOT NULL`)
				.bind(gameplay.day)
				.first<{ min_time: number }>()
				.then((res) => res || { min_time: null }),
			D1.prepare(
				`SELECT AVG(time) as avg_time FROM gameplay WHERE user_uuid = ? AND day <= ? AND day >= ? AND time IS NOT NULL`
			)
				.bind(gameplay.user_uuid, gameplay.day, gameplay.day - 7 * 86400000) // 7 days in milliseconds
				.first<{ avg_time: number }>()
				.then((res) => res || { avg_time: null })
		]);

	return {
		day: gameplay.day,
		word: gameplay.word,
		time: gameplay.time,
		userWeeklyAverage,
		averageForDay,
		fastestTime,
		numHintsUsed: gameplay.num_hints || 0,
		isCurrentUser: user_uuid && user_uuid === gameplay.user_uuid
	};
};
