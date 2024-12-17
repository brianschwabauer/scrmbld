import { getDailyWord } from '$lib/server/daily-word.server';

export function load({ cookies }) {
	const { today, tomorrow, yesterday } = getDailyWord();
	if (!cookies.get('scrmbld_user_uuid')) {
		cookies.set('scrmbld_user_uuid', crypto.randomUUID(), { path: '/' });
	}
	return {
		words: [
			{ day: yesterday.day, word: [yesterday.word, ...yesterday.extraLetters] },
			{ day: today.day, word: [today.word, ...today.extraLetters] },
			{ day: tomorrow.day, word: [tomorrow.word, ...tomorrow.extraLetters] }
		]
	};
}
