import WORDLIST from '../../../static/wordlist.json';

/** Returns the daily words for yesterday, today, and tomorrow (to account for timezone differences) */
export function getDailyWord() {
	const firstDay = WORDLIST.firstDay;
	const list = WORDLIST.list;
	const today = new Date().setUTCHours(0, 0, 0, 0);
	const daysSinceStart = Math.max(0, Math.floor((today - firstDay) / 86400000));
	const todayWord = list[daysSinceStart % list.length];
	const yesterdayWord = list[(daysSinceStart - 1 + list.length) % list.length];
	const tomorrowWord = list[(daysSinceStart + 1) % list.length];
	return {
		yesterday: {
			day: today - 86400000,
			word: yesterdayWord[0],
			extraLetters: yesterdayWord.slice(1)
		},
		today: { day: today, word: todayWord[0], extraLetters: todayWord.slice(1) },
		tomorrow: { day: today + 86400000, word: tomorrowWord[0], extraLetters: tomorrowWord.slice(1) }
	};
}
