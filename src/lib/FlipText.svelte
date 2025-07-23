<script lang="ts">
	import { untrack } from 'svelte';

	const {
		/** The word to animate */
		word = '',
		/** The minimum length of the word - this will pad 'word' with blank spaces to fit this length */
		minLength = 7,
		/** The total duration in ms that each letter flap should take to animate */
		duration = 300,
		/** The number of ms between each letter flap animation */
		stagger = undefined as number | undefined,
		/** The index of the start of the current selected items */
		selectionStart = -1 as number,
		/** The index of the end of the current selected items */
		selectionEnd = -1 as number,
		/** Whether the word is successfully guessed */
		success = false,
		/** Whether the word is unsuccessfully guessed */
		error = false,
		/** The set of letters that have been used in the current gameplay */
		usedLetters = undefined as Set<number> | undefined,
		/** The class to apply to the root element */
		class: className = '',
		/** The list of letters to rotate through in the split flap animation */
		alphabet = [
			'',
			'@',
			'#',
			'+',
			'=',
			'?',
			':',
			...Array.from({ length: 10 }, (_, i) => String.fromCharCode(48 + i)),
			...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
			' ',
		],
	} = $props();
	const MAX_LETTER_ELEMENTS = 10; // max number of letter elements to display. lower this to improve performance
	const DURATION = $derived(duration);
	const STAGGER = $derived(stagger ?? Math.floor(duration * 0.2)); // number of ms between each letter animation
	const SPRING_DURATION = 1000;
	const SPRING_EASING = `linear(0,0.009,0.035 2.1%,0.141,0.281 6.7%,0.723 12.9%,0.938 16.7%,1.017,1.077,1.121,1.149 24.3%,1.159,1.163,1.161,1.154 29.9%,1.129 32.8%,1.051 39.6%,1.017 43.1%,0.991,0.977 51%,0.974 53.8%,0.975 57.1%,0.997 69.8%,1.003 76.9%,1.004 83.8%,1)`;
	const letters = $derived.by(() => {
		const split = word.toUpperCase().split('');
		return split.concat(Array.from({ length: minLength - split.length }, () => ''));
	});
	let container = $state<HTMLDivElement | undefined>(undefined);

	function animateElement(
		element: HTMLElement,
		keyframes: Keyframe[],
		options?: KeyframeAnimationOptions,
	) {
		const animation = element.animate(keyframes, {
			easing: 'linear',
			fill: 'forwards',
			...options,
		});
		animation.finished
			.then((animation) => {
				try {
					animation.commitStyles();
					animation.cancel();
				} catch (error) {
					// ignore
				}
				return animation;
			})
			.catch(() => undefined);
		return animation;
	}

	const lettersState = new Map<
		/** The index within the "letters" array that this state apply to */
		number,
		{
			/** The index in the alphabet of the currently dislayed letter */
			alphabetIndex: number;
			/** The index of the flap element that is currently active */
			flapIndex: number;
			/** The flap animations for this letter. This is used to cancel previous animations */
			flapAnimations: WeakMap<HTMLElement, Animation>;
		}
	>();
	// let activeFlaps: string[] = [];
	async function animateNextLetterFlap(letterIndex: number) {
		if (!container || !container.children[letterIndex]) return;
		const letterEl = container.children[letterIndex];
		if (!letterEl) return;
		if (!lettersState.has(letterIndex)) {
			lettersState.set(letterIndex, {
				alphabetIndex: 0,
				flapIndex: 0,
				flapAnimations: new WeakMap<HTMLElement, Animation>(),
			});
		}
		const state = lettersState.get(letterIndex);
		if (!state) return;
		const activeFlapLetter = alphabet[state.alphabetIndex] || '';
		if (activeFlapLetter === letters[letterIndex]) return;
		const nextAlphabetIndex = (state.alphabetIndex + 1) % alphabet.length;
		const staticFlapIndex = (state.flapIndex - 1 + MAX_LETTER_ELEMENTS) % MAX_LETTER_ELEMENTS;
		const motionFlapIndex = (state.flapIndex + MAX_LETTER_ELEMENTS) % MAX_LETTER_ELEMENTS;
		const allFlapsEls = Array.from(letterEl.children) as HTMLElement[];
		const motionTopFlapEl = allFlapsEls[motionFlapIndex * 2];
		const staticTopFlapEl = allFlapsEls[staticFlapIndex * 2];
		const bottomFlapEl = allFlapsEls[motionFlapIndex * 2 + 1];
		if (!motionTopFlapEl || !staticTopFlapEl || !bottomFlapEl) return;
		try {
			state.flapAnimations.get(motionTopFlapEl)?.cancel();
			state.flapAnimations.get(staticTopFlapEl)?.cancel();
			state.flapAnimations.get(bottomFlapEl)?.cancel();
		} catch (error) {}
		allFlapsEls.forEach((el, i) => {
			if (i % 2 === 0) {
				// Top flap
				const flapIndex = Math.floor(i / 2);
				el.style.zIndex = `${(flapIndex - staticFlapIndex + MAX_LETTER_ELEMENTS) % MAX_LETTER_ELEMENTS}`;
			} else {
				// Bottom flap
				const flapIndex = Math.floor(i / 2) + 1;
				el.style.zIndex = `${(motionFlapIndex - flapIndex + MAX_LETTER_ELEMENTS) % MAX_LETTER_ELEMENTS}`;
			}
		});
		staticTopFlapEl.style.opacity = '1';
		staticTopFlapEl.style.transform = 'rotate3d(1, 0, 0, 0deg)';
		staticTopFlapEl.style.filter = 'brightness(1)';
		bottomFlapEl.style.opacity = `0`;
		bottomFlapEl.style.transform = `rotate3d(1, 0, 0, 90deg)`;
		staticTopFlapEl.style.setProperty('--letter', `'${alphabet[nextAlphabetIndex]}'`);
		motionTopFlapEl.style.setProperty(
			'--letter',
			`'${alphabet[nextAlphabetIndex - 1 < 0 ? alphabet.length - 1 : nextAlphabetIndex - 1]}'`,
		);
		bottomFlapEl.style.setProperty(
			'--letter',
			`'${alphabet[(nextAlphabetIndex + alphabet.length) % alphabet.length]}'`,
		);

		const topFlapAnimation = animateElement(
			motionTopFlapEl,
			[
				{
					transform: 'rotate3d(1, 0, 0, 0deg)',
					opacity: 1,
					offset: 0,
					filter: 'brightness(1)',
				},
				{
					transform: 'rotate3d(1, 0, 0, -90deg)',
					opacity: 1,
					offset: 0.99,
					filter: 'brightness(.5)',
				},
				{
					transform: 'rotate3d(1, 0, 0, -90deg)',
					filter: 'brightness(1)',
					opacity: 0,
					offset: 1,
				},
			],
			{ duration: DURATION },
		);
		const bottomFlapAnimation = animateElement(
			bottomFlapEl,
			[
				{ transform: 'rotate3d(1, 0, 0, 90deg)', opacity: 1 },
				{ transform: 'rotate3d(1, 0, 0, 0deg)', opacity: 1 },
			],
			{
				duration: SPRING_DURATION,
				delay: DURATION,
				easing: SPRING_EASING,
			},
		);
		state.flapAnimations.set(motionTopFlapEl, topFlapAnimation);
		state.flapAnimations.set(bottomFlapEl, bottomFlapAnimation);
		lettersState.set(letterIndex, {
			alphabetIndex: nextAlphabetIndex,
			flapIndex: staticFlapIndex,
			flapAnimations: state.flapAnimations,
		});
		await new Promise((r) => setTimeout(r, STAGGER));
		animateNextLetterFlap(letterIndex);
	}

	$effect(() => {
		if (!container) return;
		letters;
		untrack(() => {
			setTimeout(() => {
				letters.forEach((letter, i) => {
					animateNextLetterFlap(i);
				});
			}, 1000);
		});
	});
</script>

<div
	class={['flip-text', className].filter(Boolean).join(' ')}
	bind:this={container}
	class:success
	class:error
>
	{#each new Array(Math.max(minLength, letters.length)) as _, i (i)}
		<div
			class="letters"
			class:used={usedLetters?.has(i)}
			class:selected={Math.abs(selectionEnd - selectionStart) >= 1
				? i >= selectionStart && i < selectionEnd
				: i >= selectionStart && i <= selectionEnd}
		>
			{#each new Array(MAX_LETTER_ELEMENTS) as _, j (j)}
				<div class="part top"></div>
				<div class="part bottom"></div>
			{/each}
		</div>
	{/each}
</div>

<style lang="scss">
	.flip-text {
		position: relative;
		display: flex;
		font-size: 1em;
		line-height: 1em;
		font-family: 'Roboto Mono', monospace;
		font-optical-sizing: auto;
		font-weight: 500;
		font-style: normal;
		gap: max(2px, 0.1em);
		justify-content: center;
		z-index: 1;
		&::before {
			content: '';
			position: absolute;
			top: -0.12em;
			left: -0.12em;
			right: -0.12em;
			bottom: -0.12em;
			box-shadow: inset 1px 1px 0.08em 1px black;
			border-radius: 0.08em;
			background-color: #282828;
		}
		&.success {
			.letters {
				color: #00b7a1;
				&.used {
					color: #83b3ad;
				}
				&.selected {
					// color: #289487;
					color: #00b7a1;
				}
			}
		}
		&.error {
			.letters {
				color: #ef6262;
				&.used {
					color: #b38383;
				}
				&.selected {
					// color: #ca3030;
					color: #ef6262;
				}
			}
		}
		.letters {
			display: grid;
			grid-template-columns: 1fr;
			grid-template-rows: 1fr;
			perspective: 200px;
			user-select: none;
			color: #dddddd;
			position: relative;
			--gap: max(2px, 0.045em);
			box-shadow:
				1px 1px 1px 0px rgba(0, 0, 0, 0.8),
				2px 2px 4px 0px rgba(0, 0, 0, 0.25);
			border-radius: 0.05em;
			contain: content;
			&::after {
				content: '';
				position: absolute;
				top: calc(50% - var(--gap) / 2);
				left: -0.12em;
				right: -0.12em;
				height: var(--gap);
				background-color: #222222;
				z-index: 100;
			}
			&.used {
				color: #666666;
			}
			&.selected {
				outline: solid 0.03em #aaaaaa;
				color: #ffffff;
			}
			.part {
				grid-column: 1 / 1;
				grid-row: 1 / 1;
				font-size: 2em;
				width: 0.75em;
				height: 1em;
				padding: 0 0 0.05em;
				display: flex;
				align-items: center;
				justify-content: center;
				background-color: #333333;
				backface-visibility: hidden;
				transform-origin: center center;
				will-change: transform, opacity;
				border-radius: 2px;
				&:global(::before) {
					content: var(--letter, ' ');
				}
				&.top {
					--clip: calc(50% - var(--gap) / 2);
					clip-path: polygon(0 0, 100% 0, 100% var(--clip), 0 var(--clip));
					background-image: linear-gradient(170deg, #414141 0%, #303030 50%);
				}
				&.bottom {
					--clip: calc(50% + var(--gap) / 2);
					clip-path: polygon(0 var(--clip), 100% var(--clip), 100% 100%, 0 100%);
					background-image: linear-gradient(170deg, #383838 50%, #272727 100%);
				}
			}
			.part {
				opacity: 0;
			}
		}
	}
</style>
