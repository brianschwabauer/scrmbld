import { redirect } from '@sveltejs/kit';
import { initAuth } from '$lib/server/auth';

export const load = async ({ request, platform, url, cookies }) => {
	if (!platform?.env?.D1) return { fromResults: false };

	const auth = initAuth(platform.env.D1, platform.env);
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (session) {
		throw redirect(302, '/account');
	}

	// Check if coming from results page - set cookie for auto-import
	const fromResults = url.searchParams.get('from') === 'results';
	if (fromResults) {
		cookies.set('scrmbld_import_on_signin', 'true', {
			path: '/',
			maxAge: 60 * 30, // 30 minutes
			httpOnly: true,
			sameSite: 'lax',
		});
	}

	return { fromResults };
};
