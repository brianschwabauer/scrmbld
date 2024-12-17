import { getDailyWord } from '$lib/server/daily-word.server';

export function load() {
	const { today, tomorrow, yesterday } = getDailyWord();
	return {
		words: [
			{ day: yesterday.day, word: [yesterday.word, ...yesterday.extraLetters] },
			{ day: today.day, word: [today.word, ...today.extraLetters] },
			{ day: tomorrow.day, word: [tomorrow.word, ...tomorrow.extraLetters] }
		]
	};
}
