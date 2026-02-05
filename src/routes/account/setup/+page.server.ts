import { redirect } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { user } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const load = async ({ request, platform, url, cookies }) => {
	if (!platform?.env?.D1) return { shouldImport: false };

	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		throw redirect(302, '/signin');
	}
	if (!session.user.emailVerified) {
		throw redirect(302, '/verify-email');
	}

	// Check if we should auto-import after setup
	const shouldImport =
		url.searchParams.get('import') === 'true' || cookies.get('scrmbld_import_on_signin') === 'true';

	return {
		user: session.user,
		shouldImport,
	};
};

export const actions = {
	save: async ({ request, platform, url, cookies }) => {
		if (!platform?.env?.D1) return { success: false, error: 'Database unavailable' };

		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim() || '';
		const username = (formData.get('username') as string)?.trim().toLowerCase() || '';

		const db = createDb(platform.env.D1);

		// Validate username if provided
		if (username) {
			if (!/^[a-zA-Z0-9]{6,}$/.test(username)) {
				return { success: false, error: 'Username must be at least 6 alphanumeric characters' };
			}

			// Check if username is taken
			const existing = await db.query.user.findFirst({
				where: eq(user.username, username),
			});

			if (existing && existing.id !== session.user.id) {
				return { success: false, error: 'Username is already taken' };
			}

			await db.update(user).set({ name, username }).where(eq(user.id, session.user.id));
		} else {
			await db.update(user).set({ name }).where(eq(user.id, session.user.id));
		}

		// Check if we should auto-import and redirect accordingly
		const shouldImport =
			url.searchParams.get('import') === 'true' ||
			cookies.get('scrmbld_import_on_signin') === 'true';

		throw redirect(302, shouldImport ? '/account?import=true' : '/account');
	},

	skip: async ({ request, platform, url, cookies }) => {
		if (!platform?.env?.D1) throw redirect(302, '/account');

		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) throw redirect(302, '/signin');

		// Check if we should auto-import and redirect accordingly
		const shouldImport =
			url.searchParams.get('import') === 'true' ||
			cookies.get('scrmbld_import_on_signin') === 'true';

		throw redirect(302, shouldImport ? '/account?import=true' : '/account');
	},
};
