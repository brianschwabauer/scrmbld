import WORDLIST from '../../../../static/5-letter-words.json';
import { initAuth } from '$lib/server/auth';

export async function load({ cookies, request, platform }) {
	const firstDay = WORDLIST.firstDay;
	const list = WORDLIST.list;
	const today = new Date().setUTCHours(0, 0, 0, 0);
	const daysSinceStart = Math.max(0, Math.floor((today - firstDay) / 86400000));
	const todayWord = list[daysSinceStart % list.length];
	const yesterdayWord = list[(daysSinceStart - 1 + list.length) % list.length];
	const tomorrowWord = list[(daysSinceStart + 1) % list.length];

	// Only set anonymous UUID if user is not signed in
	let isSignedIn = false;
	if (platform?.env?.D1) {
		try {
			const auth = initAuth(platform.env.D1);
			const session = await auth.api.getSession({ headers: request.headers });
			isSignedIn = !!session;
		} catch {
			// Ignore auth errors
		}
	}

	if (!isSignedIn && !cookies.get('scrmbld_user_uuid')) {
		cookies.set('scrmbld_user_uuid', crypto.randomUUID(), { path: '/' });
	}
	const mutedPreference = cookies.get('scrmbld_muted') === 'true';

	return {
		mutedPreference,
		words: [
			{ day: today - 86400000, word: yesterdayWord },
			{ day: today, word: todayWord },
			{ day: today + 86400000, word: tomorrowWord }
		]
	};
}
