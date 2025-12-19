import { error } from '@sveltejs/kit';
import type { GamePlay } from '../../api/gameplay/gameplay.type';

export async function load({ platform, params, cookies, url }) {
	const D1 = platform?.env?.D1;
	if (!D1) throw error(500, { message: 'Database not available' });

	const now = Date.now();
	const user_uuid = cookies.get('scrmbld_user_uuid');
	const gameplay = await D1.prepare(`SELECT * FROM gameplay WHERE uuid = ?`)
		.bind(params.gameplay_id)
		.first<GamePlay>();
	if (!gameplay?.uuid || !gameplay?.started_at) {
		throw error(404, { message: 'Gameplay results not found' });
	}

	// If the gameplay has not ended yet, we need to mark it as ended
	if (!gameplay.ended_at) {
		const times = [];
		let state: Partial<GamePlay> | undefined = undefined;
		try {
			state = JSON.parse(
				atob((url.searchParams.get('state') || '').replace(/-/g, '+').replace(/_/g, '/')),
			);
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (error) {
			// ignore
		}
		let time = 0;
		if (state?.json?.times && Array.isArray(state?.json?.times)) {
			for (const record of state.json.times) {
				if (Array.isArray(record) && record.length === 2) {
					times.push(record);
					time += record[1] - record[0];
				}
			}
		}
		if (!time) time = now - gameplay.started_at;
		const num_hints = Math.max(0, Math.min(state?.num_hints || 0, gameplay.word.length + 1));
		console.log(
			`Finishing gameplay for ${gameplay.day} with word ${gameplay.word}: ${gameplay.user_uuid}`,
		);

		// Update the gameplay record to show that it has been finished
		const result = await D1.prepare(
			`UPDATE gameplay
				SET ended_at = ?,
					json = ?,
					time = ?,
					num_hints = ?
				WHERE uuid = ?`,
		)
			.bind(now, JSON.stringify({ times }), time, num_hints, params.gameplay_id)
			.run();
		if (result.success) {
			console.log(`Ran query successfully`, result);
		} else {
			console.log(`Ran query unsuccessfully`, result.error, result);
		}
		if (!result.success) throw error(500, `Couldn't save gameplay to database`);
		gameplay.ended_at = now;
		gameplay.time = time;
		gameplay.num_hints = num_hints;
		gameplay.json = { times };
	}

	const fiftyTwoWeeksAgo = new Date(gameplay.day).setUTCDate(
		// 52 weeeks ago, adjusted to the start of that week (Sunday)
		new Date(gameplay.day).getUTCDate() - new Date(gameplay.day).getUTCDay() - 52 * 7,
	);
	const [todaysResultsQuery, userResultsQuery] = await Promise.all([
		D1.prepare(
			`SELECT * FROM gameplay WHERE day = ? AND time IS NOT NULL AND time >= 5000 AND time <= 600000 ORDER BY ended_at DESC LIMIT 200`,
		)
			.bind(gameplay.day)
			.all<GamePlay>(),
		D1.prepare(`SELECT time, day FROM gameplay WHERE user_uuid = ? AND day <= ? AND day >= ?`)
			.bind(gameplay.user_uuid, gameplay.day, fiftyTwoWeeksAgo)
			.all<Pick<GamePlay, 'time' | 'day'>>(),
	]);
	if (!todaysResultsQuery.success || !userResultsQuery.success) {
		throw error(500, { message: 'Failed to fetch results' });
	}
	const userResults = [...userResultsQuery.results.sort((a, b) => b.day - a.day)];
	const todaysResults = todaysResultsQuery.results;
	const averageForDay =
		todaysResults.reduce((acc, curr) => acc + Math.min(180000, curr.time || 0), 0) /
			todaysResults.length || 0;
	const LIMIT_RESULTS_TO_STANDARD_DEVIATION = false; // Whether to limit results to within a certain standard deviation
	const STANDARD_DEVIATION_THRESHOLD = 1.5; // Number of standard deviations to filter by. Lower values include less results.
	const standardDeviation = Math.sqrt(
		todaysResults.reduce((acc, curr) => acc + Math.pow((curr.time || 0) - averageForDay, 2), 0) /
			todaysResults.length || 0,
	);
	const fastestTime = todaysResults
		.filter(
			(result) =>
				result.time &&
				(!LIMIT_RESULTS_TO_STANDARD_DEVIATION ||
					(result.time >= averageForDay - STANDARD_DEVIATION_THRESHOLD * standardDeviation &&
						result.time <= averageForDay + STANDARD_DEVIATION_THRESHOLD * standardDeviation)),
		)
		.map((result) => result.time || 0)
		.reduce((min, curr) => (curr < min ? curr : min), gameplay.time || Infinity);

	const userWeeklyAverageResults = userResults.filter(
		(result) => result.time && result.day >= gameplay.day - 7 * 86400000,
	);
	const userWeeklyAverage =
		userWeeklyAverageResults.reduce((acc, curr) => acc + Math.min(180000, curr.time || 0), 0) /
		(userWeeklyAverageResults.length || 1);

	let userStreak = 0;
	for (const { time, day } of userResults) {
		if (time && day === gameplay.day - 86400000 * userStreak) {
			userStreak++;
		} else {
			break;
		}
	}

	return {
		day: gameplay.day,
		word: gameplay.word,
		time: gameplay.time || 0,
		userWeeklyAverage,
		userStreak,
		userHistory: userResults.reduce(
			(acc, curr) => {
				acc[`${curr.day}`] = curr.time ?? null;
				return acc;
			},
			{} as Record<string, number | null>,
		),
		averageForDay,
		fastestTime,
		numHintsUsed: gameplay.num_hints || 0,
		isCurrentUser: user_uuid && user_uuid === gameplay.user_uuid,
	};
}
