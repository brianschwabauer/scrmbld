import WORDLIST from '../../../../static/5-letter-words.json';

export function load({ cookies }) {
	const firstDay = WORDLIST.firstDay;
	const list = WORDLIST.list;
	const today = new Date().setUTCHours(0, 0, 0, 0);
	const daysSinceStart = Math.max(0, Math.floor((today - firstDay) / 86400000));
	const todayWord = list[daysSinceStart % list.length];
	const yesterdayWord = list[(daysSinceStart - 1 + list.length) % list.length];
	const tomorrowWord = list[(daysSinceStart + 1) % list.length];

	if (!cookies.get('scrmbld_user_uuid')) {
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
