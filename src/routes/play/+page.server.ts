import { getDailyWord } from '$lib/server/daily-word.server';
import { initAuth } from '$lib/server/auth';

export async function load({ cookies, request, platform }) {
	const { today, tomorrow, yesterday } = getDailyWord();

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
			{ day: yesterday.day, word: [yesterday.word, ...yesterday.extraLetters] },
			{ day: today.day, word: [today.word, ...today.extraLetters] },
			{ day: tomorrow.day, word: [tomorrow.word, ...tomorrow.extraLetters] },
		],
	};
}
