<script lang="ts">
	import { untrack } from 'svelte';
	import { backIn } from 'svelte/easing';
	import { scale } from 'svelte/transition';

	const {
		word = '',
		minLength = 7,
		duration = 300,
		selectionStart = -1 as number,
		selectionEnd = -1 as number,
		success = false,
		error = false,
		usedLetters = undefined as Set<number> | undefined,
		class: className = '',
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
			' '
		]
	} = $props();
	const DURATION = $derived(duration);
	const STAGGER = $derived(Math.floor(duration * 0.2)); // number of ms between each letter animation
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
		options?: KeyframeAnimationOptions
	) {
		const animation = element.animate(keyframes, {
			easing: 'linear',
			fill: 'forwards',
			...options
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

	let prevLetters: string[] = [];
	$effect(() => {
		if (!container) return;
		letters;
		untrack(() => {
			let previousAnimations: Animation[] = [];
			previousAnimations.forEach((animation) => {
				try {
					animation.cancel();
				} catch (error) {
					// ignore
				}
			});
			previousAnimations = [];
			letters.forEach((letter, i) => {
				if (!container?.children?.[i]) return;
				if (letter === prevLetters[i]) return;
				const letterEl = container.children[i];
				const allLettersEl = Array.from(letterEl.children) as HTMLElement[];
				const letterIndex = Math.max(0, alphabet.indexOf(letter));
				const prevLetter = prevLetters[i] || '';
				const prevLetterIndex = Math.max(0, alphabet.indexOf(prevLetter));
				if (prevLetterIndex === letterIndex) return;
				const distance = (letterIndex - prevLetterIndex + alphabet.length) % alphabet.length;
				allLettersEl.forEach((el, j) => {
					const index = Math.floor(j / 2);
					const distanceFromPrevLetterIndex =
						(index - prevLetterIndex + alphabet.length) % alphabet.length;
					const isBetweenPrevAndNext = distanceFromPrevLetterIndex < distance;
					const isTop = el.classList.contains('top') && !el.classList.contains('blank');
					const isBottom = el.classList.contains('bottom') && !el.classList.contains('blank');
					const stagger = STAGGER - Math.max(1, distance / 20) * 10;
					if (isTop) {
						el.style.zIndex = `${alphabet.length - distanceFromPrevLetterIndex + 1}`;
						if (index === letterIndex) {
							el.getAnimations().forEach((animation) => {
								try {
									animation.cancel();
								} catch (error) {
									// ignore
								}
							});
							el.style.opacity = '1';
							el.style.transform = 'rotate3d(1, 0, 0, 0deg)';
							el.style.filter = 'none';
						} else if (index === prevLetterIndex) { // onlyAnimateOneLetter is true by default
							previousAnimations.push(
								animateElement(
									el,
									[
										{
											transform: 'rotate3d(1, 0, 0, 0deg)',
											opacity: 1,
											offset: 0,
											filter: 'brightness(1)'
										},
										{
											transform: 'rotate3d(1, 0, 0, -90deg)',
											opacity: 1,
											offset: 0.99,
											filter: 'brightness(.5)'
										},
										{
											transform: 'rotate3d(1, 0, 0, -90deg)',
											filter: 'brightness(1)',
											opacity: 0,
											offset: 1
										}
									],
									{
										duration: DURATION,
										delay: 0 // No stagger delay for single letter animation
									}
								)
							);
						} else { // Hide other letters
							previousAnimations.push(
								animateElement(
									el,
									[{ transform: 'rotate3d(1, 0, 0, 90deg)', opacity: 0, filter: 'brightness(1)' }],
									{
										duration: DURATION,
										// delay: distanceFromPrevLetterIndex * stagger // No stagger
										delay: 0
									}
								)
							);
						}
					}
					if (isBottom) {
						const distanceFromLetterIndex =
							(index - letterIndex - 1 + alphabet.length) % alphabet.length;
						el.style.zIndex = `${distanceFromLetterIndex + 1}`;
						if (index === prevLetterIndex) {
							el.getAnimations().forEach((animation) => {
								try {
									animation.cancel();
								} catch (error) {
									// ignore
								}
							});
							el.style.opacity = `1`;
							el.style.transform = `rotate3d(1, 0, 0, 0deg)`;
						} else if (index === letterIndex) { // onlyAnimateOneLetter is true by default
							el.style.opacity = `0`;
							el.style.transform = `rotate3d(1, 0, 0, 90deg)`;
							previousAnimations.push(
								animateElement(
									el,
									[
										{ transform: 'rotate3d(1, 0, 0, 90deg)', opacity: 1 },
										{ transform: 'rotate3d(1, 0, 0, 0deg)', opacity: 1 }
									],
									{
										duration: SPRING_DURATION,
										delay: DURATION, // Standard delay for the new letter's bottom part
										easing: SPRING_EASING
									}
								)
							);
						} else { // Hide other letters
							el.style.opacity = `0`;
							el.style.transform = `rotate3d(1, 0, 0, 90deg)`;
						}
					}
				});
			});
			prevLetters = $state.snapshot(letters);
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
			{#each alphabet as l (l)}
				<div class="part top">{l}</div>
				<div class="part bottom">
					{l}
				</div>
			{/each}
			<div class="blank top"></div>
			<div class="blank bottom"></div>
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
			.part,
			.blank {
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
