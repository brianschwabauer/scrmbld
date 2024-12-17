import { randomNumberGenerator } from '$lib';
import ALL_WORDS from './../../../../static/allwords.txt?raw';
import WORDLIST from './../../../../static/wordlist.txt?raw';
import PREVIOUS_WORDLIST from './../../../../static/wordlist.json';

// The canonical start day where the first word from the list will be used
// If the list runs out of words, it will start over from the beginning
const FIRST_DAY = 1734393600000;

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
const daysSinceStart = Math.max(0, Math.floor((Date.now() - FIRST_DAY) / 86400000));

export function GET({ url }) {
	const WORD_LENGTH = 7;
	const numExtraLetters = +(url.searchParams.get('numExtraLetters') || '') || 1;
	const checkFullWordList =
		url.searchParams.get('checkFullWordList') === '1' ||
		url.searchParams.get('checkFullWordList') === 'true';
	const words = WORDLIST.split('\n')
		.map((word) => word.toLowerCase().trim())
		.filter((word) => word && word.match(/^[a-z]+$/) && word.length === WORD_LENGTH);

	// Check if any words were removed from the wordlist
	// If they have been removed, they should be kept in the list,
	// if they would mess up the canonical order by being removed
	const removedWords = PREVIOUS_WORDLIST.list.filter(([word]) => !words.includes(word));
	removedWords.forEach(([word]) => words.push(word));
	words.sort();

	// Get the list of words that have been added since the last wordlist was generated
	// These words should be added to the end of the list so they don't mess up the canonical order
	const addedWords = words.filter(
		(word) => !PREVIOUS_WORDLIST.list.some(([previousWord]) => previousWord === word)
	);

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

	// First sort the list so that newly added words are at the end
	// This is necessary to keep the canonical order of the wordlist
	list.sort((a, b) => {
		const aIsOriginal = +PREVIOUS_WORDLIST.list.some(([word]) => word === a[0]);
		const bIsOriginal = +PREVIOUS_WORDLIST.list.some(([word]) => word === b[0]);
		return bIsOriginal - aIsOriginal;
	});

	// Sort the items that haven't been recently added in a deterministic random way
	const randomizeList = randomNumberGenerator();
	const sortPosition = list.length - addedWords.length;
	for (let i = sortPosition - 1; i >= 0; i--) {
		const j = Math.floor(randomizeList.next().value * (i + 1));
		[list[i], list[j]] = [list[j], list[i]];
	}

	// Sort the rest of the items (that are safely past the canonical first day)
	for (let i = list.length - 1; i >= daysSinceStart; i--) {
		const j = Math.floor(randomizeList.next().value * (i + 1 - daysSinceStart) + daysSinceStart);
		[list[i], list[j]] = [list[j], list[i]];
	}

	// Remove the words that were removed from the wordlist and don't effect the canonical order
	removedWords.forEach(([removedWord]) => {
		const removeIndex = list.findIndex(([word]) => word === removedWord);
		if (removeIndex > -1) {
			const originalIndex = PREVIOUS_WORDLIST.list.findIndex(([word]) => word === removedWord);
			if (originalIndex > daysSinceStart) list.splice(removeIndex, 1);
		}
	});

	return new Response(
		JSON.stringify({
			firstDay: FIRST_DAY,
			list: list.filter((letters) => letters.length === numExtraLetters + 1)
		}),
		{
			headers: {
				'content-type': 'application/json; charset=UTF-8'
			}
		}
	);
}
