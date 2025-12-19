import { error } from '@sveltejs/kit';
import { type GamePlay } from '../../gameplay.type';

export async function POST({ request, platform, params }) {
	const d1 = platform?.env?.D1;
	if (!d1) throw error(500, 'Database not available');
	const uuid = params.gameplay_id;
	if (request.headers.get('Content-Type') !== 'application/json') {
		throw error(415, 'Must be JSON');
	}

	const body = await request.json<any>();
	if (!body || typeof body !== 'object') {
		throw error(400, 'Invalid JSON');
	}
	const now = Date.now();

	// Get the gameplay with the given UUID to make sure it exists
	const gameplay = await d1
		.prepare(`SELECT * FROM gameplay WHERE uuid = ?`)
		.bind(uuid)
		.first<GamePlay>();
	if (!gameplay) throw error(404, `Gameplay not found`);
	if (gameplay.ended_at || gameplay.time) throw error(400, `Gameplay already finished`);
	const times = [];
	let time = 0;
	if (body.times && Array.isArray(body.times)) {
		for (const record of body.times) {
			if (Array.isArray(record) && record.length === 2) {
				times.push(record);
				time += record[1] - record[0];
			}
		}
	}
	if (!time) time = now - gameplay.started_at;
	const num_hints = Math.max(0, Math.min(body?.num_hints || 0, gameplay.word.length + 1));
	console.log(
		`Finishing gameplay for ${gameplay.day} with word ${gameplay.word}: ${gameplay.user_uuid}`
	);

	// Update the gameplay record to show that it has been finished
	const result = await d1
		.prepare(
			`UPDATE gameplay
			SET ended_at = ?,
				json = ?,
				time = ?,
				num_hints = ?
			WHERE uuid = ?`
		)
		.bind(now, JSON.stringify({ times }), time, num_hints, uuid)
		.run();
	if (result.success) {
		console.log(`Ran query successfully`, result);
	} else {
		console.log(`Ran query unsuccessfully`, result.error, result);
	}
	if (!result.success) throw error(500, `Couldn't save gameplay to database`);
	return new Response(null, { status: 204 });
}
