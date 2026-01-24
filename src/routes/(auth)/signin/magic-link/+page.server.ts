export const load = async ({ url, cookies }) => {
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
