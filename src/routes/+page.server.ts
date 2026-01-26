import { initAuth } from '$lib/server/auth';

export const load = async ({ request, platform }) => {
	if (!platform?.env?.D1) return { session: null };

	const auth = initAuth(platform.env.D1);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	return { session };
};
