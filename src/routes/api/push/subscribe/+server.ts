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
	let body: {
		endpoint: string;
		keys: {
			p256dh: string;
			auth: string;
		};
		timezone?: string;
	};

	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
		return new Response(JSON.stringify({ error: 'Missing required fields' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = createDb(platform.env.D1);

	// Check if subscription already exists for this user and endpoint
	const existing = await db.query.pushSubscription.findFirst({
		where: and(
			eq(pushSubscription.userId, session.user.id),
			eq(pushSubscription.endpoint, body.endpoint),
		),
	});

	if (existing) {
		// Update existing subscription
		await db
			.update(pushSubscription)
			.set({
				p256dh: body.keys.p256dh,
				auth: body.keys.auth,
				timezone: body.timezone || null,
			})
			.where(eq(pushSubscription.id, existing.id));
	} else {
		// Create new subscription
		await db.insert(pushSubscription).values({
			id: crypto.randomUUID(),
			userId: session.user.id,
			endpoint: body.endpoint,
			p256dh: body.keys.p256dh,
			auth: body.keys.auth,
			timezone: body.timezone || null,
			createdAt: new Date(),
		});
	}

	// Notify the Durable Object notification worker via service binding
	if (platform.env.NOTIFICATIONS) {
		try {
			await platform.env.NOTIFICATIONS.subscribe({
				userId: session.user.id,
				endpoint: body.endpoint,
				p256dh: body.keys.p256dh,
				auth: body.keys.auth,
				timezone: body.timezone || 'UTC',
			});
		} catch (error) {
			console.error('Failed to notify DO worker:', error);
			// Don't fail the request - D1 subscription is saved
		}
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
