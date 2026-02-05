/* eslint-disable @typescript-eslint/no-unused-vars */
import { error } from '@sveltejs/kit';
import { UAParser } from 'ua-parser-js';
import { getDailyWord } from '$lib/server/daily-word.server';
import { initAuth } from '$lib/server/auth';

export async function POST({ cookies, request, getClientAddress, platform }) {
	const d1 = platform?.env?.D1;
	if (!d1) throw error(500, 'Database not available');

	// Check if user is signed in
	let userId: string | null = null;
	try {
		const auth = initAuth(d1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (session) {
			userId = session.user.id;
		}
	} catch {
		// Ignore auth errors
	}

	const uuid = crypto.randomUUID();
	let user_uuid = cookies.get('scrmbld_user_uuid');

	// Only set anonymous UUID cookie if user is not signed in
	if (!userId && !user_uuid) {
		user_uuid = crypto.randomUUID();
		cookies.set('scrmbld_user_uuid', user_uuid, { path: '/' });
	}

	// Use a placeholder if no user_uuid (signed-in user without cookie)
	if (!user_uuid) {
		user_uuid = `user:${userId}`;
	}
	const ua = request.headers.get('User-Agent') || undefined;
	const ip = getClientAddress() || undefined;
	let parsedUA: any;
	try {
		parsedUA = new UAParser(ua).getResult();
	} catch (error) {
		// ignore
	}
	if (request.headers.get('Content-Type') !== 'application/json') {
		throw error(415, 'Must be JSON');
	}
	const body = await request.json<any>();
	if (!body || typeof body !== 'object') {
		throw error(400, 'Invalid JSON');
	}
	const { day, word } = body;
	if (!day) throw error(400, 'Gameplay day is required');
	if (!word) throw error(400, 'Gameplay word is required');
	const { yesterday, today, tomorrow } = getDailyWord();
	if (
		(day !== today.day || word !== today.word) &&
		(day !== yesterday.day || word !== yesterday.word) &&
		(day !== tomorrow.day || word !== tomorrow.word)
	) {
		throw error(400, 'Gameplay word must match gameplay day and must be the current day');
	}
	const now = Date.now();
	console.log(`Saving gameplay for ${day} with word ${word}: ${userId || user_uuid}`);
	const result = await d1
		.prepare(
			`INSERT INTO gameplay (
			uuid,
			word,
			day,
			user_uuid,
			user_id,
			started_at,
			ip,
			ip_city,
			ip_country,
			ip_latitude,
			ip_longitude,
			ip_region,
			ip_timezone,
			ua,
			ua_browser,
			ua_os,
			ua_device
	 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			uuid,
			word,
			day,
			user_uuid,
			userId,
			now,
			ip,
			platform?.cf?.city || null,
			platform?.cf?.country || null,
			platform?.cf?.latitude || null,
			platform?.cf?.longitude || null,
			platform?.cf?.region || platform?.cf?.regionCode || null,
			platform?.cf?.timezone || null,
			ua,
			parsedUA?.browser?.name || null,
			parsedUA?.os?.name || null,
			[parsedUA?.device?.vendor, parsedUA?.device?.model].filter(Boolean).join(' ') || null,
		)
		.run();
	if (result.success) {
		console.log(`Ran query successfully`, result);
	} else {
		console.log(`Ran query unsuccessfully`, result.error, result);
	}
	if (!result.success) throw error(500, `Couldn't save gameplay to database`);
	return new Response(JSON.stringify({ uuid }), {
		status: 201,
		headers: { Location: `/api/gameplay/${uuid}/finish`, 'Content-Type': 'application/json' },
	});
}
