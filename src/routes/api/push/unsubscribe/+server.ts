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

	// Parse request body
	let body: { endpoint: string };

	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (!body.endpoint) {
		return new Response(JSON.stringify({ error: 'Missing endpoint' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = createDb(platform.env.D1);

	// Delete subscription
	await db
		.delete(pushSubscription)
		.where(
			and(
				eq(pushSubscription.userId, session.user.id),
				eq(pushSubscription.endpoint, body.endpoint),
			),
		);

	// Notify the Durable Object notification worker via service binding
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
