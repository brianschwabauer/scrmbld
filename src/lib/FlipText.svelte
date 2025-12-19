<script lang="ts">
	import { untrack } from 'svelte';
	import { playFailureSound, playSplitFlapSound, playSuccessSound } from './audio';

	const {
		/** The word to animate */
		word = '',
		/** The minimum length of the word - this will pad 'word' with blank spaces to fit this length */
		minLength = 7,
		/** The total duration in ms that each letter flap should take to animate */
		duration = 300,
		/** The number of ms between each letter flap animation */
		stagger = undefined as number | undefined,
		/** Whether to play sound effects when animating letters */
		sound = false,
		/** The volume of the sound effects, between 0 and 1 */
		volume = 1,
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
		/** The callback for when one of the flip text characters is clicked */
		onclick = undefined as ((index: number) => void) | undefined,
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
					const { transform, opacity, filter } = keyframes[keyframes.length - 1];
					if (transform) element.style.transform = transform as string;
					if (opacity) element.style.opacity = opacity as string;
					if (filter) element.style.filter = filter as string;
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
	async function animateLetterToTarget(letterIndex: number) {
		if (!container || !container.children[letterIndex]) return;
		const letterEl = container.children[letterIndex];
		if (!letterEl) return;

		if (!lettersState.has(letterIndex)) {
			lettersState.set(letterIndex, {
				alphabetIndex: 0, // Start from the beginning of the alphabet
				flapIndex: 0,
				flapAnimations: new WeakMap<HTMLElement, Animation>(),
			});
		}

		if (sound) {
			const alphabetDistance =
				lettersState.get(letterIndex)!.alphabetIndex <= alphabet.indexOf(letters[letterIndex])
					? alphabet.indexOf(letters[letterIndex]) - lettersState.get(letterIndex)!.alphabetIndex
					: alphabet.length -
						lettersState.get(letterIndex)!.alphabetIndex +
						alphabet.indexOf(letters[letterIndex]);
			setTimeout(() => {
				playSplitFlapSound({ ticks: Math.min(alphabetDistance, 40), delay: STAGGER + 10, volume });
			}, 200);
		}

		// Loop until the target letter is reached for this position
		while (true) {
			const state = lettersState.get(letterIndex);
			if (!state) break; // Should not happen under normal circumstances

			const currentDisplayedLetter = alphabet[state.alphabetIndex] || '';
			const targetLetter = letters[letterIndex];

			// If the currently displayed letter matches the target, stop animating this letter
			if (currentDisplayedLetter === targetLetter) {
				break; // Exit the loop for this specific letter
			}

			const nextAlphabetIndex = (state.alphabetIndex + 1) % alphabet.length;
			const staticFlapIndex = (state.flapIndex - 1 + MAX_LETTER_ELEMENTS) % MAX_LETTER_ELEMENTS;
			const motionFlapIndex = (state.flapIndex + MAX_LETTER_ELEMENTS) % MAX_LETTER_ELEMENTS;
			const allFlapsEls = Array.from(letterEl.children) as HTMLElement[];
			const motionTopFlapEl = allFlapsEls[motionFlapIndex * 2];
			const staticTopFlapEl = allFlapsEls[staticFlapIndex * 2];
			const bottomFlapEl = allFlapsEls[motionFlapIndex * 2 + 1];
			if (!motionTopFlapEl || !staticTopFlapEl || !bottomFlapEl) break; // Safety break if DOM elements are missing

			// Cancel any ongoing animations on the flaps involved in the current step
			try {
				state.flapAnimations.get(motionTopFlapEl)?.cancel();
				state.flapAnimations.get(staticTopFlapEl)?.cancel();
				state.flapAnimations.get(bottomFlapEl)?.cancel();
			} catch (error) {
				// Ignore errors from cancelling animations that might not exist or be active
			}

			// Set z-index for visual stacking during the flip
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

			// Set initial states for the flaps before animation
			staticTopFlapEl.style.opacity = '1';
			staticTopFlapEl.style.transform = 'rotate3d(1, 0, 0, 0deg)';
			staticTopFlapEl.style.filter = 'brightness(1)';
			bottomFlapEl.style.opacity = `0`;
			bottomFlapEl.style.transform = `rotate3d(1, 0, 0, 90deg)`;

			// Set the CSS variables for the letters on the flaps for the current flip
			staticTopFlapEl.style.setProperty('--letter', `'${alphabet[nextAlphabetIndex]}'`);
			motionTopFlapEl.style.setProperty('--letter', `'${currentDisplayedLetter}'`);
			bottomFlapEl.style.setProperty('--letter', `'${alphabet[nextAlphabetIndex]}'`);

			// Initiate Web Animations
			const topFlapAnimation = animateElement(
				motionTopFlapEl,
				[
					{ transform: 'rotate3d(1, 0, 0, 0deg)', opacity: 1, offset: 0, filter: 'brightness(1)' },
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

			// Store references to current animations for potential cancellation
			state.flapAnimations.set(motionTopFlapEl, topFlapAnimation);
			state.flapAnimations.set(bottomFlapEl, bottomFlapAnimation);

			// Update the state for the next iteration of the loop (if needed)
			state.alphabetIndex = nextAlphabetIndex;
			state.flapIndex = staticFlapIndex;

			// Wait for the staggering delay before potentially initiating the next flap animation
			await new Promise((r) => setTimeout(r, STAGGER));
		}
	}

	$effect(() => {
		if (!success || !sound) return;
		playSuccessSound();
	});
	$effect(() => {
		if (!error || !sound) return;
		playFailureSound();
	});

	$effect(() => {
		if (!container) return;
		letters;
		untrack(() => {
			letters.forEach((letter, i) => {
				animateLetterToTarget(i);
			});
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
		<svelte:element
			this={onclick ? 'button' : 'div'}
			role={onclick ? 'button' : undefined}
			onclick={() => onclick?.(i)}
			disabled={onclick && usedLetters?.has(i) ? true : undefined}
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
		</svelte:element>
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
		button.letters:not(:disabled) {
			cursor: pointer;
			touch-action: manipulation;
			&:hover {
				color: #ffffff;
				transition: scale 100ms ease;
				.part {
					&:global(::after) {
						opacity: 1;
						transition: none;
					}
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
			background-color: transparent;
			--gap: max(2px, 0.045em);
			box-shadow:
				1px 1px 1px 0px rgba(0, 0, 0, 0.8),
				2px 2px 4px 0px rgba(0, 0, 0, 0.25);
			border-radius: 0.05em;
			contain: content;
			margin: 0;
			padding: 0;
			border: none;
			outline: none;
			-webkit-tap-highlight-color: transparent;
			font-size: 1em;
			font-family: 'Roboto Mono', monospace;
			font-weight: 500;
			transition:
				color 300ms ease,
				scale 100ms ease;
			&:active:not(:disabled):not(.used) {
				scale: 0.95;
			}
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
				&:global(::after) {
					content: '';
					position: absolute;
					inset: 0;
					background-color: rgb(255 255 255 / 0.1);
					opacity: 0;
					pointer-events: none;
					transition: opacity 300ms ease;
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
