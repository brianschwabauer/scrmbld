import type { RequestHandler } from './$types';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { pushSubscription } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.D1) {
		return Response.json({ error: 'Database unavailable' }, { status: 500 });
	}

	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: {
		dailyReminder?: boolean;
		friendActivity?: boolean;
		weeklyRecap?: boolean;
	};

	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const updates: Record<string, number> = {};
	if (body.dailyReminder !== undefined) updates.notifyDailyReminder = body.dailyReminder ? 1 : 0;
	if (body.friendActivity !== undefined) updates.notifyFriendActivity = body.friendActivity ? 1 : 0;
	if (body.weeklyRecap !== undefined) updates.notifyWeeklyRecap = body.weeklyRecap ? 1 : 0;

	if (Object.keys(updates).length === 0) {
		return Response.json({ error: 'No preferences to update' }, { status: 400 });
	}

	const db = createDb(platform.env.D1);
	await db
		.update(pushSubscription)
		.set(updates)
		.where(eq(pushSubscription.userId, session.user.id));

	return Response.json({ success: true });
};
