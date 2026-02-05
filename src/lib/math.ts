/** Returns a random number (between 0-1) based on the provided seed. Will always return the same value for each seed */
export function seededRandom(seed: number) {
	let a = Math.abs(seed) < 1 ? Math.abs(seed * 1000000000) : Math.abs(seed);
	let t = (a += 0x6d2b79f5);
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Returns a seeded random number generator that will return a deterministic random number after calling "next()" for each number */
export function randomNumberGenerator() {
	let seed = 1;
	const generator = () => {
		seed = seededRandom(seed);
		return { value: seed, next: generator };
	};
	return generator();
}
