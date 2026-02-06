import type { RequestHandler } from './$types';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { pushSubscription } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ request, platform }) => {
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

	const devices = await db
		.select({
			deviceId: pushSubscription.deviceId,
			deviceName: pushSubscription.deviceName,
			createdAt: pushSubscription.createdAt,
		})
		.from(pushSubscription)
		.where(eq(pushSubscription.userId, session.user.id));

	return new Response(
		JSON.stringify({
			devices: devices.map((d) => ({
				deviceId: d.deviceId,
				deviceName: d.deviceName || 'Unknown Device',
				createdAt: d.createdAt,
			})),
		}),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		},
	);
};
