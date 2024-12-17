import { randomNumberGenerator } from '$lib';
import WORDLIST from '../../../static/wordlist.json';

export function load() {
	const options = WORDLIST as string[][];
	const random = randomNumberGenerator();
	for (let i = options.length - 1; i >= 0; i--) {
		const j = Math.floor(random.next().value * (i + 1));
		[options[i], options[j]] = [options[j], options[i]];
	}
	const today = new Date().setUTCHours(0, 0, 0, 0);
	const yesterday = new Date(today).setUTCDate(new Date().getUTCDate() - 1);
	const tomorrow = new Date(today).setUTCDate(new Date().getUTCDate() + 1);
	return {
		words: [
			{ day: yesterday, word: options[(yesterday / 86400000) % options.length] },
			{ day: today, word: options[(today / 86400000) % options.length] },
			{ day: tomorrow, word: options[(tomorrow / 86400000) % options.length] }
		]
	};
}
