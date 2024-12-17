import WORDLIST from '../../../static/wordlist.json';

export function load() {
	const firstDay = WORDLIST.firstDay;
	const list = WORDLIST.list;
	const today = new Date().setUTCHours(0, 0, 0, 0);
	const daysSinceStart = Math.max(0, Math.floor((today - firstDay) / 86400000));
	return {
		words: [
			{ day: today - 86400000, word: list[(daysSinceStart - 1 + list.length) % list.length] },
			{ day: today, word: list[daysSinceStart % list.length] },
			{ day: today + 86400000, word: list[(daysSinceStart + 1) % list.length] }
		]
	};
}
