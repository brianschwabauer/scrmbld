import type { RequestHandler } from './$types';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { pushSubscription } from '$lib/server/schema';
import { and, eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.D1) {
		return new Response(JSON.stringify({ error: 'Database unavailable' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Verify auth
	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Parse request body — accepts either deviceId or endpoint for backwards compat
	let body: { deviceId?: string; endpoint?: string };

	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (!body.deviceId && !body.endpoint) {
		return new Response(JSON.stringify({ error: 'Missing deviceId or endpoint' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = createDb(platform.env.D1);

	// Look up the subscription to get the endpoint (needed for DO sync)
	let sub;
	if (body.deviceId) {
		sub = await db.query.pushSubscription.findFirst({
			where: and(
				eq(pushSubscription.userId, session.user.id),
				eq(pushSubscription.deviceId, body.deviceId),
			),
		});
	} else {
		sub = await db.query.pushSubscription.findFirst({
			where: and(
				eq(pushSubscription.userId, session.user.id),
				eq(pushSubscription.endpoint, body.endpoint!),
			),
		});
	}

	if (sub) {
		// Delete from D1
		await db.delete(pushSubscription).where(eq(pushSubscription.id, sub.id));

		// Remove specific device from DO (pass endpoint so only this device is removed)
		if (platform.env.NOTIFICATIONS) {
			try {
				await platform.env.NOTIFICATIONS.unsubscribe(session.user.id, sub.endpoint);
			} catch (error) {
				console.error('Failed to notify DO worker:', error);
			}
		}
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
