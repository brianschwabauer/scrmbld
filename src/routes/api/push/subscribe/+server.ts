import type { RequestHandler } from './$types';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { pushSubscription } from '$lib/server/schema';
import { and, eq } from 'drizzle-orm';

/** Generate a device ID from the push endpoint (first 16 hex chars of SHA-256) */
async function generateDeviceId(endpoint: string): Promise<string> {
	const data = new TextEncoder().encode(endpoint);
	const hash = await crypto.subtle.digest('SHA-256', data);
	const bytes = new Uint8Array(hash);
	return Array.from(bytes.slice(0, 8))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Parse User-Agent into a human-readable device name */
function parseDeviceName(userAgent: string): string {
	let browser = 'Unknown Browser';
	let os = 'Unknown OS';

	if (userAgent.includes('Firefox/')) browser = 'Firefox';
	else if (userAgent.includes('Edg/')) browser = 'Edge';
	else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) browser = 'Chrome';
	else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) browser = 'Safari';

	if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
	else if (userAgent.includes('Android')) os = 'Android';
	else if (userAgent.includes('Mac OS X')) os = 'macOS';
	else if (userAgent.includes('Windows')) os = 'Windows';
	else if (userAgent.includes('Linux')) os = 'Linux';
	else if (userAgent.includes('CrOS')) os = 'ChromeOS';

	return `${browser} on ${os}`;
}

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
	const deviceId = await generateDeviceId(body.endpoint);
	const deviceName = parseDeviceName(request.headers.get('User-Agent') || '');

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
				deviceName,
				deviceId,
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
			deviceName,
			deviceId,
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
				deviceName,
				deviceId,
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
