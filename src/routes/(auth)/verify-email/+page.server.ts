import { redirect } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';

export const load = async ({ request, platform, url }) => {
	const emailFromQuery = url.searchParams.get('email');
	const isNewSignup = url.searchParams.get('new') === 'true';

	if (!platform?.env?.D1) {
		return { email: emailFromQuery, hasSession: false, isNewSignup };
	}

	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (session) {
		// If already verified, redirect to account
		if (session.user.emailVerified) {
			throw redirect(302, '/account');
		}

		return {
			email: session.user.email,
			hasSession: true,
			isNewSignup,
		};
	}

	// No session - check if we have email from query params
	if (!emailFromQuery) {
		throw redirect(302, '/signin');
	}

	return {
		email: emailFromQuery,
		hasSession: false,
		isNewSignup,
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
