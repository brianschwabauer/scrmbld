import { error } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import {
	user,
	gameplay,
	friendship,
	achievement,
	pushSubscription,
	account,
	session,
} from '$lib/server/schema';
import { eq, or } from 'drizzle-orm';

export async function POST({ request, platform, cookies }) {
	const d1 = platform?.env?.D1;
	if (!d1) throw error(500, 'Database not available');

	const auth = initAuth(d1);
	const authSession = await auth.api.getSession({ headers: request.headers });
	if (!authSession) throw error(401, 'Unauthorized');

	// Verify confirmation
	let body: { confirm?: boolean } = {};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	if (!body?.confirm) {
		throw error(400, 'Confirmation required');
	}

	const db = createDb(d1);
	const userId = authSession.user.id;

	// 1. Anonymize gameplay records (preserve for aggregate stats)
	await db.update(gameplay).set({ userId: null }).where(eq(gameplay.userId, userId));

	// 2. Delete friendships
	await db
		.delete(friendship)
		.where(or(eq(friendship.userId1, userId), eq(friendship.userId2, userId)));

	// 3. Delete push subscriptions (table may not exist yet, use try/catch)
	try {
		await db.delete(pushSubscription).where(eq(pushSubscription.userId, userId));
	} catch {
		// Table doesn't exist yet, ignore
	}

	// 4. Delete achievements (table may not exist yet)
	try {
		await db.delete(achievement).where(eq(achievement.userId, userId));
	} catch {
		// Table doesn't exist yet, ignore
	}

	// 5. Delete auth records (order matters due to foreign keys)
	await db.delete(account).where(eq(account.userId, userId));
	await db.delete(session).where(eq(session.userId, userId));

	// 6. Delete user
	await db.delete(user).where(eq(user.id, userId));

	// 7. Clear session cookies
	cookies.delete('scrmbld-auth.session_token', { path: '/' });
	cookies.delete('scrmbld-auth.session_token.sig', { path: '/' });

	return new Response(null, { status: 204 });
}
