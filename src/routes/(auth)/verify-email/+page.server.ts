import { redirect } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';

export const load = async ({ request, platform }) => {
	if (!platform?.env?.D1) return { email: null };

	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		throw redirect(302, '/signin');
	}

	// If already verified, redirect to account
	if (session.user.emailVerified) {
		throw redirect(302, '/account');
	}

	return {
		email: session.user.email,
	};
};

export const actions = {
	resendVerification: async ({ request, platform }) => {
		if (!platform?.env?.D1) return { success: false, error: 'Service unavailable' };

		const auth = initAuth(platform.env.D1);
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			return { success: false, error: 'Not signed in' };
		}

		if (session.user.emailVerified) {
			return { success: false, error: 'Email already verified' };
		}

		try {
			await auth.api.sendVerificationEmail({
				body: { email: session.user.email },
				headers: request.headers,
			});
			return { success: true, message: 'Verification email sent!' };
		} catch (e: any) {
			console.error('Failed to send verification email', e);
			return { success: false, error: e?.message || 'Failed to send verification email' };
		}
	},
};
