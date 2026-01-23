import { redirect } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';

export const load = async ({ request, platform }) => {
	if (!platform?.env?.D1) return {};

	const auth = initAuth(platform.env.D1, platform.env);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (session) {
		throw redirect(302, '/account');
	}

	return {};
};
