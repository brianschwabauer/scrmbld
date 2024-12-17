import { randomNumberGenerator } from '$lib';
import ALL_WORDS from './../../../../static/allwords.txt?raw';
import WORDLIST from './../../../../static/wordlist.txt?raw';

const aToZ = [
	'a',
	'b',
	'c',
	'd',
	'e',
	'f',
	'g',
	'h',
	'i',
	'j',
	'k',
	'l',
	'm',
	'n',
	'o',
	'p',
	'q',
	'r',
	's',
	't',
	'u',
	'v',
	'w',
	'x',
	'y',
	'z'
];
const frequency = {
	e: 12.02,
	t: 9.1,
	a: 8.12,
	o: 7.68,
	i: 7.31,
	n: 6.95,
	s: 6.28,
	r: 6.02,
	h: 5.92,
	d: 4.32,
	l: 3.98,
	u: 2.88,
	c: 2.71,
	m: 2.61,
	f: 2.3,
	y: 2.11,
	w: 2.09,
	g: 2.03,
	p: 1.82,
	b: 1.49,
	v: 1.11,
	k: 0.69,
	x: 0.17,
	q: 0.11,
	j: 0.1,
	z: 0.07
};

export function GET({ url }) {
	const WORD_LENGTH = 7;
	const numExtraLetters = +(url.searchParams.get('numExtraLetters') || '') || 1;
	const checkFullWordList =
		url.searchParams.get('checkFullWordList') === '1' ||
		url.searchParams.get('checkFullWordList') === 'true';
	const words = WORDLIST.split('\n')
		.map((word) => word.toLowerCase().trim())
		.filter((word) => word && word.match(/^[a-z]+$/) && word.length === WORD_LENGTH);
	const allWordHashes = ALL_WORDS.split('\n')
		.map((word) => word.toLowerCase().trim())
		.filter((word) => word && word.match(/^[a-z]+$/) && word.length === WORD_LENGTH)
		.reduce(
			(prev, word) => {
				prev.push([word, word.split('').sort().join('')]);
				return prev;
			},
			[] as [string, string][]
		);
	const wordHashList = words.reduce(
		(prev, word) => {
			const hash = word.split('').sort().join('');
			if (checkFullWordList) {
				const hashUsedByWordNotInWordlist = allWordHashes.filter(
					(v) => v && v[0] !== word && v[1] === hash
				);
				if (hashUsedByWordNotInWordlist.length) {
					hashUsedByWordNotInWordlist.forEach((v) => {
						console.log('Word has hash collision with word not in wordlist', word, v[0]);
					});
					return prev;
				}
			}
			const hashExists = prev.findIndex((v) => v && v[1] === hash);
			if (hashExists > -1) {
				if (prev[hashExists][0] !== word) delete prev[hashExists];
				return prev;
			}
			prev.push([word, hash]);
			return prev;
		},
		[] as [string, string][]
	);
	const wordHashRecord = allWordHashes.reduce(
		(prev, [word, hash]) => {
			prev[hash] = word;
			return prev;
		},
		{} as Record<string, string>
	);
	function doLettersCreateUsedHash(originalHash: string, letters: string[]): boolean {
		if (letters.length < WORD_LENGTH) return false;
		if (letters.length === WORD_LENGTH) {
			const hash = letters.sort().join('');
			if (hash === originalHash) return false;
			return !!wordHashRecord[hash];
		}
		for (let i = 0; i < letters.length; i++) {
			const check = [...letters].sort();
			check.splice(i, 1);
			if (doLettersCreateUsedHash(originalHash, check)) return true;
		}
		return false;
	}
	const list = wordHashList.map(([word, hash]) => {
		const letters = word.split('').sort();
		const unusedLetters: string[] = [];
		aToZ.forEach((letter) => {
			if (letters.filter((v) => v === letter).length > 1) return;
			if (doLettersCreateUsedHash(hash, [...letters, letter])) return;
			unusedLetters.push(letter);
		});
		const lettersToChooseFrom: string[] = [];
		unusedLetters.forEach((letter) => {
			if (!(letter in frequency)) return;
			const amount = Math.floor(((frequency as any)[letter] as number) * 10);
			for (let i = 0; i < amount; i++) {
				lettersToChooseFrom.push(letter);
			}
		});
		const random = randomNumberGenerator();
		for (let i = lettersToChooseFrom.length - 1; i >= 0; i--) {
			const j = Math.floor(random.next().value * (i + 1));
			[lettersToChooseFrom[i], lettersToChooseFrom[j]] = [
				lettersToChooseFrom[j],
				lettersToChooseFrom[i]
			];
		}
		const additionalLetters: string[] = [];
		const removedDuplicates = lettersToChooseFrom.filter((v, i, a) => a.indexOf(v) === i);
		while (additionalLetters.length < numExtraLetters && removedDuplicates.length) {
			const letter = removedDuplicates.shift();
			if (!letter) continue;
			if (doLettersCreateUsedHash(hash, [...letters, ...additionalLetters, letter])) continue;
			additionalLetters.push(letter);
		}
		return [word, ...additionalLetters];
	});
	return new Response(
		JSON.stringify(list.filter((letters) => letters.length === numExtraLetters + 1)),
		{
			headers: {
				'content-type': 'application/json; charset=UTF-8'
			}
		}
	);
}
