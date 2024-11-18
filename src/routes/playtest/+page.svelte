<script lang="ts">
	import { browser } from '$app/environment';
	import { assets } from '$app/paths';
	import { randomNumberGenerator } from '$lib';
	import FlipText from '$lib/FlipText.svelte';
	import Keyboard from '$lib/Keyboard.svelte';
	import Popover from '$lib/Popover.svelte';
	import { ripple } from '$lib/ripple';
	import { tooltip } from '$lib/tootltip.js';
	import { untrack } from 'svelte';
	import { Confetti } from 'svelte-confetti';
	import { quartInOut } from 'svelte/easing';
	import { type TransitionConfig } from 'svelte/transition';

	const { data } = $props();
	const words = $derived(data.words);
	const today = $derived(new Date().setHours(0, 0, 0, 0));
	const todaysWord = $derived(words.findLast(({ day }) => today >= day) || words[0]);
	const answer = $derived(todaysWord.word[0].toUpperCase());
	const random = randomNumberGenerator();
	let mixletters = $state(todaysWord.word.slice(1, 2));
	let inputEl = $state<HTMLInputElement | undefined>(undefined);
	let answerEl = $state<HTMLDivElement | undefined>(undefined);
	let shuffling = $state(false);
	let scrambled = $state(shuffle(false));
	let attempt = $state('');
	let selectionStart = $state(0);
	let selectionEnd = $state(0);
	let times = $state<number[][]>([]);
	let hintLetters = $state(0);
	const success = $derived(!!answer && attempt === answer);
	const time = $derived(
		times.reduce((total, [start, end]) => {
			return total + Math.max(0, Math.round((end - start) / 1000));
		}, 0)
	); // number of seconds since the start of the game
	let didCopyToClipboard = $state(false);
	let shareButtonEl = $state<HTMLButtonElement | undefined>(undefined);
	const useNativeShare = $derived(
		browser &&
			typeof navigator !== undefined &&
			'share' in navigator &&
			!navigator.userAgent.includes('Windows')
	);
	const timeDisplay = $derived.by(() => {
		const hours = Math.floor(time / 3600);
		const minutes = Math.floor((time % 3600) / 60);
		const seconds = time % 60;
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
				.toString()
				.padStart(2, '0')}`;
		}
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	});
	const usedLetters = $derived.by(() => {
		const letterIndexes = new Set<number>();
		attempt.split('').forEach((letter, i) => {
			let index: number | undefined;
			while (index === undefined || index > -1 || index >= scrambled.length - 1) {
				index = scrambled.indexOf(letter, (index ?? -1) + 1);
				if (index > -1 && !letterIndexes.has(index)) {
					letterIndexes.add(index);
					break;
				}
			}
		});
		return letterIndexes;
	});
	const shareURL = `https://scrmbld.app`;
	const shareText = $derived(`🅂🄲🅁🄼🄱🄻🄳 ⏲${timeDisplay}`);

	function openNativeShare() {
		if (!useNativeShare || typeof navigator === 'undefined' || !navigator.share) return;
		navigator.share({
			title: '🅂🄲🅁🄼🄱🄻🄳',
			text: shareText
			// url: shareURL
		});
	}

	function shareOnTwitter() {
		const twitterUrl = new URL(`https://twitter.com/intent/tweet`);
		twitterUrl.searchParams.set('text', shareText);
		// twitterUrl.searchParams.set('url', shareURL);
		window.open(twitterUrl.href, '_blank');
	}

	function shareOnFacebook() {
		const twitterUrl = new URL(`https://www.facebook.com/share.php`);
		twitterUrl.searchParams.set('[title]', shareText);
		twitterUrl.searchParams.set('u', shareURL);
		window.open(twitterUrl.href, '_blank');
	}

	function shareToClipboard() {
		if (typeof navigator === 'undefined') return;
		navigator.clipboard.writeText(shareText);
		didCopyToClipboard = true;
		setTimeout(() => {
			didCopyToClipboard = false;
		}, 5000);
	}

	const audioEffects = browser
		? [{ start: 0, end: 2.5, audio: new Audio(`${assets}/splitflap.mp3`) }]
		: [];
	audioEffects.forEach((effect) => effect.audio.load());
	function playSoundEffect(effect: number) {
		if (!audioEffects[effect]) return;
		const audio = audioEffects[effect].audio;
		const isPlaying =
			audio.currentTime > 0 && !audio.paused && !audio.ended && audio.readyState > 2;
		if (isPlaying) return;
		audio.currentTime = audioEffects[effect].start;
		audio.play();
		const cb = () => {
			if (audio.currentTime >= audioEffects[effect].end) {
				audio.pause();
				audio.removeEventListener('timeupdate', cb);
			}
		};
		audio.addEventListener('timeupdate', cb);
	}
	$effect(() => playSoundEffect(0));

	function shuffle(playSound = true) {
		shuffling = true;
		if (playSound) playSoundEffect(0);
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

	function applyHint() {
		if (mixletters.length) {
			mixletters.pop();
			scrambled = shuffle();
			return;
		}
		if (hintLetters >= answer.length) return;
		hintLetters++;
		attempt = answer.slice(0, hintLetters) + attempt.slice(hintLetters);
	}

	function onWindowKeyUp(e: KeyboardEvent) {
		if (!inputEl) return;
		if (e.target === inputEl || inputEl === document.activeElement) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === 'ArrowLeft') {
			selectionStart = Math.max(selectionStart - 1, 0);
			selectionEnd = Math.max(selectionStart, 1);
			inputEl.setSelectionRange(selectionStart, selectionEnd);
			return;
		}
		if (e.key === 'ArrowRight') {
			selectionEnd = Math.min(selectionEnd + 1, 7, attempt.length - hintLetters);
			selectionStart = Math.min(selectionEnd, 6);
			inputEl.setSelectionRange(selectionStart, selectionEnd);
			return;
		}
		if (e.key === 'Backspace') {
			selectionStart = Math.max(Math.min(selectionStart, selectionEnd - 1), 0);
			attempt =
				answer.slice(0, hintLetters) +
				attempt.slice(hintLetters, hintLetters + selectionStart) +
				attempt.slice(hintLetters + selectionEnd);
			selectionStart++;
			selectionEnd = selectionStart;
			inputEl.setSelectionRange(selectionStart, selectionEnd);
			return;
		}
		if (!e.key.match(/^[A-Za-z]$/)) return;
		const key = e.key.toUpperCase();
		attempt =
			answer.slice(0, hintLetters) +
			attempt.slice(hintLetters, hintLetters + selectionStart) +
			key +
			attempt.slice(hintLetters + selectionEnd);
		selectionStart++;
		selectionEnd = selectionStart;
		inputEl.setSelectionRange(selectionStart, selectionEnd);
	}

	function hintProgressTransition(node: HTMLElement): TransitionConfig {
		return {
			easing: quartInOut,
			duration: 500,
			css: (t, u) => {
				return `
					width: calc(var(--width) * ${t});
					opacity: ${t};
				`;
			}
		};
	}

	$effect(() => {
		if (success) return;
		if (answer && attempt === answer) {
			if (times[times.length - 1]) times[times.length - 1][1] = Date.now();
			clearInterval(interval);
			localStorage.setItem(
				`scrmbld_${todaysWord.day}`,
				JSON.stringify({ ...todaysWord, times, success })
			);
		}
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
		if (success) return;
		if (!times.length) {
			try {
				const savedInfo = JSON.parse(localStorage.getItem(`scrmbld_${todaysWord.day}`) || '');
				if (savedInfo) {
					times = savedInfo.times;
					if (savedInfo.success) attempt = answer;
				}
			} catch (error) {
				// ignore
			}
		}
		untrack(() => {
			setTimeout(() => {
				if (!times.length) {
					const now = Date.now();
					times.push([now, now]);
				}
				interval = setInterval(() => {
					if (success || !times.length) return;
					const now = Date.now();
					if (times[times.length - 1][1] < now - 3000) {
						times.push([now, now]);
					} else {
						times[times.length - 1][1] = now;
					}
					localStorage.setItem(
						`scrmbld_${todaysWord.day}`,
						JSON.stringify({ ...todaysWord, times, success })
					);
				}, 1000);
			}, 1500);
		});
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>Play | SCRMBLD</title>
</svelte:head>

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
	<div class="answer" bind:this={answerEl}>
		{#if hintLetters}
			<FlipText
				class="hint"
				word={answer.slice(0, hintLetters)}
				duration={100}
				onlyAnimateOneLetter
				success
				minLength={hintLetters}
			/>
		{/if}
		<FlipText
			word={attempt.slice(hintLetters)}
			duration={100}
			{selectionEnd}
			{selectionStart}
			onlyAnimateOneLetter
			{success}
			error={attempt.length === answer.length && !success}
			minLength={answer.length - hintLetters}
		/>
		<input
			bind:this={inputEl}
			type="text"
			style:--num-letters={answer.length - hintLetters}
			value={attempt.slice(hintLetters)}
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
				attempt = answer.slice(0, hintLetters) + newValue;
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
	<div class="question">
		<FlipText word={scrambled} {usedLetters} duration={350} />
	</div>
	<div class="actions">
		{#if success}
			<button
				use:ripple
				onclick={() => {
					attempt = '';
					times = [];
					hintLetters = 0;
					localStorage.removeItem(`scrmbld_${todaysWord.day}`);
				}}>Reset</button
			>
		{:else}
			<button disabled={shuffling} onclick={() => (scrambled = shuffle())} use:ripple
				>Shuffle</button
			>
		{/if}
		<div class="timer">
			<FlipText
				word={timeDisplay}
				minLength={4}
				duration={200}
				alphabet={[
					'',
					'@',
					'#',
					'+',
					'=',
					'?',
					':',
					'0',
					'1',
					'2',
					'3',
					'4',
					'5',
					'6',
					'7',
					'8',
					'9'
				]}
			/>
		</div>
		{#if success}
			<button class="primary" onclick={openNativeShare} bind:this={shareButtonEl}>Share</button>
			{#if !useNativeShare}
				<Popover refElement={shareButtonEl} openOnClick>
					<div class="share-popover">
						<h3>{shareText}</h3>
						<div class="buttons">
							<button
								onclick={shareToClipboard}
								aria-label="Copy share text"
								use:tooltip={'Copy score to clipboard'}
								use:ripple
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"
									><path
										fill="currentColor"
										d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm-4 4q-.825 0-1.412-.587T3 20V6h2v14h11v2z"
									></path></svg
								>
							</button>
							<button
								onclick={shareOnTwitter}
								class="twitter"
								use:tooltip={'Share score on Twitter/X'}
								use:ripple
							>
								<img src="{assets}/x.svg" alt="Twitter Logo" />
							</button>
							<button
								onclick={shareOnFacebook}
								class="facebook"
								use:tooltip={'Share score on Facebook'}
								use:ripple
							>
								<img src="{assets}/facebook.png" alt="Facebook Logo" />
							</button>
						</div>
						{#if didCopyToClipboard}
							<p>Copied to clipboard!</p>
						{/if}
					</div>
				</Popover>
			{/if}
		{:else}
			{@const hintEnabled = time > (mixletters.length ? 60 : 120 + hintLetters * 60)}
			<button onclick={() => applyHint()} use:ripple class="hint" disabled={!hintEnabled}>
				{#if !hintEnabled && browser && time}
					<div class="hint-progress" transition:hintProgressTransition>
						<svg viewBox="0 0 100 100" style:--progress={((Math.max(0, time - 1) % 60) / 60) * 100}>
							<circle class="bg"></circle>
							<circle class="fg"></circle>
						</svg>
					</div>
				{/if}
				Hint
			</button>
		{/if}
	</div>
	<Keyboard
		onclick={(key) => {
			if (key === 'Clear') {
				attempt = '';
				selectionStart = 0;
				selectionEnd = 0;
				return;
			}
			window.dispatchEvent(new KeyboardEvent('keyup', { key }));
		}}
	></Keyboard>
</article>

<style lang="scss">
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
		padding: 4rem 0;
		@media (min-width: 768px) {
			justify-content: center;
			padding: 0;
		}
		@media (max-width: 769px) {
			:global(.keyboard) {
				position: fixed;
				bottom: 4rem;
			}
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
	.hint {
		display: flex;
		align-items: center;
	}
	.hint-progress {
		--width: 1.15em;
		--stroke-width: 15px;
		width: var(--width);
		height: var(--width);
		position: relative;
		margin: 0 0.5rem 0 -0.5rem;
		transition: width 200ms ease;
		svg {
			position: absolute;
			top: 0;
			left: 0;
			width: var(--width);
			height: var(--width);
			--size: 100px;
			--half-size: calc(var(--size) / 2);
			--radius: calc((var(--size) - var(--stroke-width)) / 2);
			--circumference: calc(var(--radius) * pi * 2);
			--dash: calc((var(--progress) * (var(--circumference) - var(--stroke-width))) / 100);
		}

		svg circle {
			cx: var(--half-size);
			cy: var(--half-size);
			r: var(--radius);
			stroke-width: var(--stroke-width);
			fill: none;
			stroke-linecap: round;
		}

		svg circle.bg {
			stroke: rgba(255, 255, 255, 0.2);
		}

		svg circle.fg {
			transform: rotate(-90deg);
			transform-origin: var(--half-size) var(--half-size);
			stroke-dasharray: var(--dash) calc(var(--circumference) - var(--dash));
			transition: stroke-dasharray 1s linear 0s;
			stroke: rgba(255, 255, 255, 0.9);
		}

		@property --progress {
			syntax: '<number>';
			inherits: false;
			initial-value: 0;
		}
	}
	button {
		-webkit-tap-highlight-color: transparent;
		position: relative;
		cursor: pointer;
		font-size: 1rem;
		text-decoration: none;
		border-radius: 999px;
		padding: 0.5em 1em;
		margin: 0;
		font-weight: 500;
		outline: none;
		box-shadow: none;
		border: none;
		background-color: rgba(255, 255, 255, 0.05);
		color: #dddddd;
		font-family: 'Roboto Mono', monospace;
		font-optical-sizing: auto;
		font-weight: 400;
		font-style: normal;
		@media (min-width: 600px) {
			font-size: 1.5rem;
		}
		&:disabled {
			opacity: 0.65;
			cursor: not-allowed;
		}
		&:hover:not(:disabled) {
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
		display: flex;
		flex-direction: column;
		gap: 1rem;
		font-size: 1rem;
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
		margin-bottom: 1rem;
		@media (min-width: 350px) {
			font-size: 2rem;
		}
		@media (min-width: 400px) {
			font-size: 2rem;
		}
		@media (min-width: 600px) {
			font-size: 3rem;
		}
		@media (min-width: 1200px) {
			font-size: 4rem;
		}
		@media (min-width: 1600px) {
			font-size: 4.5rem;
		}
		:global(.flip-text) {
			grid-row: 1 / 1;
			grid-column: 2 / 2;
		}
		:global(.flip-text.hint) {
			grid-column: 1 / 1;
		}
		input {
			grid-row: 1 / 1;
			grid-column: 2 / 2;
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
			width: calc(0.8em * var(--num-letters));
			padding: 0 0 0 0.1em;
			margin: 0;
			line-height: 1em;
			letter-spacing: 0.22em;
			text-align: left;
			opacity: 0;
		}
	}

	.share-popover {
		color: #333333;
		padding: 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem 0.5rem;
		h3 {
			padding: 0;
			margin: 0 0 1rem;
			font-size: 2rem;
		}
		.buttons {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}
		button {
			width: 3rem;
			height: 3rem;
			border-radius: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0;
			margin: 0;
			background-color: #eeeeee;
			color: #333333;
			svg,
			img {
				width: 1.5rem;
				height: 1.5rem;
			}
			&.twitter {
				background-color: black;
			}
			&.facebook {
				img {
					width: 100%;
					height: 100%;
				}
			}
		}
	}
</style>
