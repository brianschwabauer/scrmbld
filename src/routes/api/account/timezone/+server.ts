import { error, json } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { user } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export async function POST({ request, platform }) {
	const d1 = platform?.env?.D1;
	if (!d1) throw error(500, 'Database not available');

	const auth = initAuth(d1);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) throw error(401, 'Unauthorized');

	// Only auto-save if user doesn't already have a timezone set
	if (session.user.timezone) {
		return json({ success: true, skipped: true });
	}

	const body = await request.json<{ timezone?: string }>();
	const timezone = body?.timezone;

	// Validate timezone is a valid IANA timezone
	if (!timezone || typeof timezone !== 'string') {
		throw error(400, 'Invalid timezone');
	}

	// Validate it's a real timezone
	try {
		Intl.DateTimeFormat('en-US', { timeZone: timezone });
	} catch {
		throw error(400, 'Invalid timezone');
	}

	const db = createDb(d1);
	await db.update(user).set({ timezone }).where(eq(user.id, session.user.id));

	return json({ success: true });
}
