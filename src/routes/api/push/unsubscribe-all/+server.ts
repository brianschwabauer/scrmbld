import type { RequestHandler } from './$types';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { pushSubscription } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.D1) {
		return new Response(JSON.stringify({ error: 'Database unavailable' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = createDb(platform.env.D1);

	// Delete all subscriptions for this user from D1
	await db.delete(pushSubscription).where(eq(pushSubscription.userId, session.user.id));

	// Remove all from DO (call without endpoint to remove all devices)
	if (platform.env.NOTIFICATIONS) {
		try {
			await platform.env.NOTIFICATIONS.unsubscribe(session.user.id);
		} catch (error) {
			console.error('Failed to notify DO worker:', error);
		}
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
