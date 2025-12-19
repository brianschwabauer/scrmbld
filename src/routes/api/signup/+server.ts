/* eslint-disable @typescript-eslint/no-unused-vars */
import { error } from '@sveltejs/kit';
import { UAParser } from 'ua-parser-js';

export async function POST({ request, getClientAddress, platform }) {
	const d1 = platform?.env?.D1;
	if (!d1) throw error(500, 'Database not available');
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
	const body = await request.json();
	if (!body || typeof body !== 'object') {
		throw error(400, 'Invalid JSON');
	}
	const { email: rawEmail, name } = body;
	const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
	if (!email) throw error(400, 'Email is required');
	if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
		throw error(400, 'Email is invalid');
	}

	// Check if the email is already signed up
	const existing = await d1
		.prepare(`SELECT COUNT(*) as count FROM newsletter_signup WHERE email = ?`)
		.bind(email)
		.first();
	if (existing && existing.count > 0) {
		// Already signed up, return 204 No Content
		return new Response(null, { status: 204 });
	}

	const now = Date.now();
	const result = await d1
		.prepare(
			`INSERT INTO newsletter_signup (
			email,
			name,
			created_at,
			json
	 ) VALUES (?, ?, ?, ?)`,
		)
		.bind(
			email,
			(name || '').trim() || null,
			now,
			JSON.stringify({
				ip,
				ip_city: platform?.cf?.city || undefined,
				ip_country: platform?.cf?.country || undefined,
				ip_latitude: platform?.cf?.latitude || undefined,
				ip_longitude: platform?.cf?.longitude || undefined,
				ip_region: platform?.cf?.region || platform?.cf?.regionCode || undefined,
				ip_timezone: platform?.cf?.timezone || undefined,
				ua,
				ua_browser: parsedUA?.browser?.name || undefined,
				ua_os: parsedUA?.os?.name || undefined,
				ua_device:
					[(parsedUA?.device?.vendor, parsedUA?.device?.model)].filter(Boolean).join(' ') ||
					undefined,
			}),
		)
		.run();
	if (result.success) {
		console.log(`Ran query successfully`, result);
	} else {
		console.log(`Ran query unsuccessfully`, result.error, result);
	}
	if (!result.success) throw error(500, `Couldn't complete signup`);
	return new Response(null, { status: 204 });
}
