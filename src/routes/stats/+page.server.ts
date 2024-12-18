import type { GamePlay } from '../api/gameplay/gameplay.type';

export async function load({ platform }) {
	const d1 = platform?.env?.D1;
	if (!d1) return { stats: [] };
	console.log(
		`Querying for gameplay records from ${new Date().setUTCHours(0, 0, 0, 0) - 86400000 * 7}`
	);
	const result = await d1
		.prepare(`SELECT day, word, time FROM gameplay WHERE day > ?`)
		.bind(new Date().setUTCHours(0, 0, 0, 0) - 86400000 * 7)
		.all<GamePlay>();
	if (result.success) {
		console.log(`Ran query successfully`, result);
	} else {
		console.log(`Ran query unsuccessfully`, result.error, result);
	}

	const gameplays = new Map<number, { word: string; numAttempts: number; times: number[] }>();
	result.results.forEach((game) => {
		if (!game.day) return;
		const info = gameplays.get(game.day) || { word: game.word, numAttempts: 0, times: [] };
		info.numAttempts++;
		if (game.time) info.times.push(game.time);
	});
	const stats = Array.from(gameplays.entries())
		.map(([day, { word, numAttempts, times }]) => ({
			day,
			word,
			average: Math.floor(times.reduce((a, b) => a + b, 0) / times.length),
			numAttempts,
			numCorrect: times.length
		}))
		.sort((a, b) => b.day - a.day);
	return { stats };
}
