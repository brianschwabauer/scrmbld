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
	const [
		{ avg_time: averageForDay },
		{ avg_time: userWeeklyAverage },
		{ fastest_valid_time: fastestTime },
	] = await Promise.all([
		D1.prepare(`SELECT AVG(time) as avg_time FROM gameplay WHERE day = ? AND time IS NOT NULL`)
			.bind(gameplay.day)
			.first<{ avg_time: number }>()
			.then((res) => res || { avg_time: null }),
		D1.prepare(
			`SELECT AVG(time) as avg_time FROM gameplay WHERE user_uuid = ? AND day <= ? AND day >= ? AND time IS NOT NULL`,
		)
			.bind(gameplay.user_uuid, gameplay.day, gameplay.day - 7 * 86400000) // 7 days in milliseconds
			.first<{ avg_time: number }>()
			.then((res) => res || { avg_time: null }),
		// D1.prepare(`SELECT MIN(time) as fastest_valid_time FROM gameplay WHERE day = ? AND time IS NOT NULL`)
		// 	.bind(gameplay.day)
		// 	.first<{ fastest_valid_time: number }>()
		// 	.then((res) => res || { fastest_valid_time: null }),
		D1.prepare(
			` WITH Stats AS (
					SELECT
						AVG(time) AS avg_time,
						-- Calculate standard deviation: SQRT(AVG(X^2) - (AVG(X))^2)
						SQRT(AVG(time * time) - AVG(time) * AVG(time)) AS std_dev
					FROM
						gameplay
					WHERE
						day = ? AND time IS NOT NULL AND time > 0
				)
				SELECT
					MIN(g.time) AS fastest_valid_time
				FROM
					gameplay AS g,
					Stats AS s
				WHERE
					g.time IS NOT NULL
					-- Filter out times more than 2 standard deviations below the average
					AND g.time >= s.avg_time - (2 * s.std_dev);`,
		)
			.bind(gameplay.day)
			.first<{ fastest_valid_time: number }>()
			.then((res) => res || { fastest_valid_time: null }),
	]);

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
