<script lang="ts">
	import { randomNumberGenerator } from '$lib';
	import FlipText from '$lib/FlipText.svelte';
	import { untrack } from 'svelte';
	import { Confetti } from 'svelte-confetti';

	const { data } = $props();
	const words = $derived(data.words);
	const today = $derived(new Date().setHours(0, 0, 0, 0));
	const todaysWord = $derived(words.findLast(({ day }) => today >= day)?.word || words[0]?.word);
	const answer = $derived(todaysWord[0].toUpperCase());
	const random = randomNumberGenerator();
	let mixletters = $state(todaysWord.slice(1));
	let inputEl = $state<HTMLInputElement | undefined>(undefined);
	let answerEl = $state<HTMLDivElement | undefined>(undefined);
	let shuffling = $state(false);
	let scrambled = $state(shuffle());
	let attempt = $state('');
	let selectionStart = $state(0);
	let selectionEnd = $state(0);
	let startTime = $state(Date.now());
	let endTime = $state(0);
	let time = $state(0); // number of seconds since the start of the game
	const timeDisplay = $derived.by(() => {
		const minutes = Math.floor(time / 60);
		const seconds = time % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	});
	const usedLetters = $derived.by(() => {
		const letters = new Set<number>();
		attempt.split('').forEach((letter) => {
			let index = scrambled.indexOf(letter);
			if (letters.has(index)) index = scrambled.indexOf(letter, index + 1);
			if (index > -1) letters.add(index);
		});
		return letters;
	});

	function share() {
		const shareURL = `https://scrmbld.pages.dev`;
		const shareText = `🅂🄲🅁🄼🄱🄻🄳 ⏲${timeDisplay}`;
		const twitterUrl = new URL(`https://twitter.com/intent/tweet`);
		twitterUrl.searchParams.set('text', shareText);
		// twitterUrl.searchParams.set('url', shareURL);
		window.open(twitterUrl.href, '_blank');
		// if (navigator.share) {
		// 	navigator.share({
		// 		title: '🅂🄲🅁🄼🄱🄻🄳',
		// 		text: shareText,
		// 		url: shareURL
		// 	});
		// } else {
		// 	navigator.clipboard.writeText(`${shareText}\n${shareURL}`);
		// }
	}

	function shuffle() {
		shuffling = true;
		setTimeout(() => {
			shuffling = false;
		}, 1500);
		const letters = [...answer.split(''), ...mixletters];
		for (let i = letters.length - 1; i >= 0; i--) {
			const j = Math.floor(random.next().value * (i + 1));
			[letters[i], letters[j]] = [letters[j], letters[i]];
		}
		return letters.join('').toUpperCase();
	}

	function removeExtraLetter() {
		if (mixletters.length === 0) return;
		mixletters.pop();
		scrambled = shuffle();
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	function onWindowKeyUp(e: KeyboardEvent) {
		function debounceFocus() {
			clearTimeout(timer);
			timer = setTimeout(() => {
				inputEl?.focus();
			}, 100);
		}
		if (!inputEl) return;
		if (e.target === inputEl || inputEl === document.activeElement) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === 'ArrowLeft') {
			selectionStart = Math.max(selectionStart - 1, 0);
			selectionEnd = Math.max(selectionStart, 1);
			debounceFocus();
			inputEl.setSelectionRange(selectionStart, selectionEnd);
			return;
		}
		if (e.key === 'ArrowRight') {
			selectionEnd = Math.min(selectionEnd + 1, 7);
			selectionStart = Math.min(selectionEnd, 6);
			debounceFocus();
			inputEl.setSelectionRange(selectionStart, selectionEnd);
			return;
		}
		if (e.key === 'Backspace') {
			selectionStart = Math.max(Math.min(selectionStart, selectionEnd - 1), 0);
			attempt = attempt.slice(0, selectionStart) + attempt.slice(selectionEnd);
			selectionStart++;
			selectionEnd = selectionStart;
			debounceFocus();
			inputEl.setSelectionRange(selectionStart, selectionEnd);
			return;
		}
		if (!e.key.match(/^[A-Za-z]$/)) return;
		const key = e.key.toUpperCase();
		attempt = attempt.slice(0, selectionStart) + key + attempt.slice(selectionEnd);
		selectionStart++;
		selectionEnd = selectionStart;
		debounceFocus();
		inputEl.setSelectionRange(selectionStart, selectionEnd);
	}

	$effect(() => {
		if (inputEl) {
			inputEl.focus();
		}
	});

	$effect(() => {
		if (endTime) return;
		if (answer && attempt === answer) endTime = Date.now();
	});

	$effect(() => {
		if (!answerEl || attempt.length < 7) return;
		if (attempt !== answer) {
			answerEl.animate(
				[
					{ transform: 'translate3d(-7px, 0, 0)' },
					{ transform: 'translate3d(7px, 0, 0)' },
					{ transform: 'translate3d(-15px, 0, 0)' },
					{ transform: 'translate3d(15px, 0, 0)' },
					{ transform: 'translate3d(0px, 0, 0)' }
				],
				{
					easing: 'ease-in-out',
					duration: 350
				}
			);
		}
	});

	let interval: ReturnType<typeof setInterval> | undefined;
	$effect(() => {
		clearInterval(interval);
		if (endTime) return;
		untrack(() => {
			interval = setInterval(() => {
				const now = Date.now();
				time = Math.round((now - startTime) / 1000);
			}, 1000);
		});
	});
</script>

<svelte:window onkeyup={onWindowKeyUp} />

{#if attempt === answer}
	<div class="confetti">
		<Confetti
			colorRange={[120, 250]}
			x={[-5, 5]}
			y={[0, 8]}
			amount={200}
			fallDistance="50vh"
			iterationCount={1}
		/>
	</div>
{/if}

<article>
	<div class="timer">
		<FlipText word={timeDisplay} minLength={4} duration={200} />
	</div>
	<div class="question">
		<FlipText word={scrambled} {usedLetters} />
	</div>
	<div class="answer" bind:this={answerEl}>
		<FlipText
			word={attempt}
			duration={100}
			{selectionEnd}
			{selectionStart}
			onlyAnimateOneLetter
			success={attempt === answer}
			error={attempt.length === answer.length && attempt !== answer}
		/>
		<input
			bind:this={inputEl}
			type="text"
			value={attempt}
			onkeyup={(e) => {
				const target =e.target as HTMLInputElement;
				selectionEnd = Math.min(target.selectionEnd as number, 7);
				selectionStart = Math.min(target.selectionStart as number, selectionEnd, 6);
				if (selectionStart === selectionEnd && selectionStart === 0) {
					selectionEnd = 1;
					inputEl?.setSelectionRange(selectionStart, selectionEnd);
				}
			}}
			oninput={(e) => {
				const target =e.target as HTMLInputElement;
				selectionStart = target.selectionStart as number;
				selectionEnd = target.selectionEnd as number;
				const value = target.value;
				let newValue = value.toUpperCase().replace(/[^A-Z]/g, '');
				const numberOfInvaidChars = value.length - newValue.length;
				newValue = newValue.slice(0, 7);
				selectionEnd = Math.min(selectionEnd - numberOfInvaidChars, 7);
				selectionStart = Math.min(selectionStart - numberOfInvaidChars, selectionEnd, 6);
				attempt = newValue;
				if (newValue !== value) {
					target.value = attempt;
					target.setSelectionRange(selectionStart, selectionEnd);
				}
			}}
			onselectionchange={(e) => {
				const target =e.target as HTMLInputElement;
				selectionEnd = Math.min(target.selectionEnd as number, 7);
				selectionStart = Math.min(target.selectionStart as number, selectionEnd, 6);
				if (selectionStart === selectionEnd && selectionStart === 0) {
					selectionEnd = 1;
					inputEl?.setSelectionRange(selectionStart, selectionEnd);
				}
			}}
		/>
	</div>
	<div class="actions">
		{#if endTime}
			<button class="primary" onclick={share}>Share</button>
		{:else}
			<button disabled={shuffling} onclick={() => (scrambled = shuffle())}>Shuffle</button>
			{#if mixletters.length > 0}
				<button onclick={() => removeExtraLetter()}>Hint</button>
			{/if}
		{/if}
	</div>
</article>

<style lang="scss">
	.timer {
		margin-bottom: 1rem;
	}
	.confetti {
		position: fixed;
		bottom: 0;
		left: 50%;
	}
	article {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 100vw;
		overflow: hidden;
		min-height: 100vh;
		padding: 2rem 0;
		@media (min-width: 768px) {
			justify-content: center;
			padding: 0;
		}
	}
	.actions {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
		margin-bottom: 4rem;
	}
	button {
		cursor: pointer;
		font-size: 1.5rem;
		text-decoration: none;
		border-radius: 999px;
		padding: 0.5rem 1.5rem;
		margin: 0;
		font-weight: 500;
		outline: none;
		box-shadow: none;
		border: none;
		background-color: rgba(255, 255, 255, 0.05);
		color: #eeeeee;
		&:hover {
			background-color: rgba(255, 255, 255, 0.1);
		}
		&.primary {
			background-color: #eeeeee;
			color: #333333;
			&:hover {
				background-color: #ffffff;
				color: #000000;
			}
		}
	}
	.question {
		font-size: 1rem;
		margin-bottom: 1rem;
		@media (min-width: 350px) {
			font-size: 1.35rem;
		}
		@media (min-width: 400px) {
			font-size: 1.5rem;
		}
		@media (min-width: 600px) {
			font-size: 2rem;
			margin-bottom: 2rem;
		}
		@media (min-width: 1200px) {
			font-size: 3rem;
		}
		@media (min-width: 1600px) {
			font-size: 3.5rem;
		}
	}
	.answer {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
		font-size: 1rem;
		@media (min-width: 350px) {
			font-size: 2rem;
		}
		@media (min-width: 400px) {
			font-size: 2rem;
		}
		@media (min-width: 1200px) {
			font-size: 3rem;
		}
		@media (min-width: 1600px) {
			font-size: 3.5rem;
		}
		:global(.flip-text) {
			grid-row: 1 / 1;
			grid-column: 1 / 1;
		}
		input {
			grid-row: 1 / 1;
			grid-column: 1 / 1;
			z-index: 2;
			background-color: transparent;
			border: none;
			outline: none;
			height: 1em;
			font-size: 2em;
			font-family: 'Roboto Mono', monospace;
			font-optical-sizing: auto;
			font-weight: 500;
			font-style: normal;
			width: calc(0.8em * 7);
			padding: 0 0 0 0.1em;
			margin: 0;
			line-height: 1em;
			letter-spacing: 0.22em;
			text-align: left;
			opacity: 0;
		}
	}
</style>
