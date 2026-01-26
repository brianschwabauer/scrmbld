import { redirect } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';
import { createDb } from '$lib/server/db';
import { account, gameplay, user } from '$lib/server/schema';
import { eq, and, isNull, count } from 'drizzle-orm';

export const load = async ({ request, cookies, platform, url }) => {
	if (!platform?.env?.D1) return {};

	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		throw redirect(302, '/signin');
	}

	// Check if email is verified - if not, redirect to verification page
	if (!session.user.emailVerified) {
		throw redirect(302, '/verify-email');
	}

	const db = createDb(platform.env.D1);

	// Check if user has anonymous game history to import
	const anonUuid = cookies.get('scrmbld_user_uuid');

	// Check if we should auto-import (from results page sign-in flow)
	const shouldAutoImport =
		url.searchParams.get('import') === 'true' || cookies.get('scrmbld_import_on_signin') === 'true';

	let autoImportCount = 0;
	if (shouldAutoImport && anonUuid) {
		// Auto-import game history
		const result = await db
			.update(gameplay)
			.set({ userId: session.user.id })
			.where(and(eq(gameplay.userUuid, anonUuid), isNull(gameplay.userId)))
			.returning({ id: gameplay.id });

		autoImportCount = result.length;

		// Delete the cookies
		cookies.delete('scrmbld_user_uuid', { path: '/' });
		cookies.delete('scrmbld_import_on_signin', { path: '/' });
	} else if (shouldAutoImport) {
		// Just clear the import cookie if no history to import
		cookies.delete('scrmbld_import_on_signin', { path: '/' });
	}

	// Fetch linked accounts (sign-in methods)
	const linkedAccounts = await db
		.select({
			id: account.id,
			providerId: account.providerId,
		})
		.from(account)
		.where(eq(account.userId, session.user.id));

	// Re-check if there's still history to import (in case auto-import didn't happen)
	const hasAnonHistory = !shouldAutoImport && !!anonUuid;

	return {
		user: session.user,
		hasAnonHistory,
		linkedAccounts,
		autoImportCount,
	};
};

export const actions = {
	claimHistory: async ({ cookies, platform, request }) => {
		if (!platform?.env?.D1) return { success: false, error: 'Database unavailable' };

		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const anonUuid = cookies.get('scrmbld_user_uuid');
		if (!anonUuid) {
			return { success: false, message: 'No anonymous history found on this device.' };
		}

		const db = createDb(platform.env.D1);

		// Update gameplay rows where user_uuid matches and user_id is NULL
		const result = await db
			.update(gameplay)
			.set({ userId: session.user.id })
			.where(and(eq(gameplay.userUuid, anonUuid), isNull(gameplay.userId)))
			.returning({ id: gameplay.id });

		// Delete the cookie so the section won't show again
		cookies.delete('scrmbld_user_uuid', { path: '/' });

		return {
			success: true,
			count: result.length,
			message: result.length
				? `Successfully imported ${result.length} games.`
				: 'No games to import. You may have already claimed your history.',
		};
	},

	updateProfile: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const profile = formData.get('profile') as string;
		const name = (formData.get('name') as string)?.trim() || '';
		const newUsername = (formData.get('username') as string)?.trim().toLowerCase() || '';

		const db = createDb(platform.env.D1);

		// Validate username if provided
		if (newUsername) {
			if (!/^[a-zA-Z0-9]{6,}$/.test(newUsername)) {
				return { success: false, error: 'Username must be at least 6 alphanumeric characters' };
			}

			// Check if username is taken by another user
			const existing = await db.query.user.findFirst({
				where: eq(user.username, newUsername),
			});

			if (existing && existing.id !== session.user.id) {
				return { success: false, error: 'Username is already taken' };
			}
		}

		await db
			.update(user)
			.set({
				name,
				username: newUsername || null,
				profileVisibility: profile,
			})
			.where(eq(user.id, session.user.id));

		return { success: true, message: 'Profile updated' };
	},

	unlinkAccount: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const providerId = formData.get('providerId') as string;

		const db = createDb(platform.env.D1);

		// Count how many accounts the user has linked
		const accountCount = await db
			.select({ count: count() })
			.from(account)
			.where(eq(account.userId, session.user.id));

		if (accountCount[0].count <= 1) {
			return { success: false, error: 'Cannot remove your only sign-in method' };
		}

		// Delete the account link
		await db
			.delete(account)
			.where(and(eq(account.userId, session.user.id), eq(account.providerId, providerId)));

		return { success: true };
	},

	changePassword: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!currentPassword || !newPassword) {
			return { success: false, error: 'All fields are required' };
		}

		if (newPassword.length < 8) {
			return { success: false, error: 'Password must be at least 8 characters' };
		}

		if (newPassword !== confirmPassword) {
			return { success: false, error: 'Passwords do not match' };
		}

		try {
			await auth.api.changePassword({
				body: {
					currentPassword,
					newPassword,
				},
				headers: request.headers,
			});
			return { success: true };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to change password' };
		}
	},

	changeEmail: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const newEmail = formData.get('newEmail') as string;

		if (!newEmail) {
			return { success: false, error: 'New email is required' };
		}

		const db = createDb(platform.env.D1);

		// Check if email is already taken
		const existingUser = await db.query.user.findFirst({
			where: eq(user.email, newEmail.toLowerCase()),
		});

		if (existingUser && existingUser.id !== session.user.id) {
			return { success: false, error: 'Email is already in use' };
		}

		try {
			await auth.api.changeEmail({
				body: { newEmail },
				headers: request.headers,
			});
			return { success: true, message: 'Verification email sent to new address' };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to change email' };
		}
	},

	setPassword: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false };
		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { success: false, error: 'Unauthorized' };

		const formData = await request.formData();
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!newPassword) {
			return { success: false, error: 'Password is required' };
		}

		if (newPassword.length < 8) {
			return { success: false, error: 'Password must be at least 8 characters' };
		}

		if (newPassword !== confirmPassword) {
			return { success: false, error: 'Passwords do not match' };
		}

		try {
			await auth.api.setPassword({
				body: { newPassword },
				headers: request.headers,
			});
			return { success: true };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to set password' };
		}
	},
};
