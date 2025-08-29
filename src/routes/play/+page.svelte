<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
	import { browser } from '$app/environment';
	import { assets } from '$app/paths';
	import { randomNumberGenerator } from '$lib';
	import FlipText from '$lib/FlipText.svelte';
	import Keyboard from '$lib/Keyboard.svelte';
	import { ripple } from '$lib/ripple';
	import { untrack } from 'svelte';
	import { backIn, quartInOut, quartOut } from 'svelte/easing';
	import { slide, type TransitionConfig } from 'svelte/transition';
	import type { GamePlay } from '../api/gameplay/gameplay.type';

	const { data } = $props();
	const words = $derived(data.words);
	const today = $derived(new Date().setHours(0, 0, 0, 0));
	const todaysWord = $derived((words || []).findLast(({ day }) => today >= day) || words[0]);
	const answer = $derived(todaysWord.word[0].toUpperCase());
	const random = randomNumberGenerator();
	let mixletters = $state(todaysWord.word.slice(1));
	let inputEl = $state<HTMLInputElement | undefined>(undefined);
	let answerEl = $state<HTMLDivElement | undefined>(undefined);
	let shuffling = $state(false);
	let scrambled = $state(shuffle(false));
	let attempt = $state('');
	let selectionStart = $state(0);
	let selectionEnd = $state(0);
	let times = $state<number[][]>([]);
	let hintLetters = $state(0);
	let wasKeyboardInput = $state(false);
	let gameplayID = $state<string | undefined>(undefined);
	let gameplayStartSaved = $state(false);
	let gameplayEndSaved = $state(false);
	const alreadySolved = $derived(gameplayEndSaved && !!gameplayID);
	const success = $derived(!!answer && attempt === answer);
	const time = $derived(
		times.reduce((total, [start, end]) => {
			return total + Math.max(0, Math.round((end - start) / 1000));
		}, 0),
	); // number of seconds since the start of the game
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
	const numHintsUsed = $derived(
		Math.max(0, Math.min(7, todaysWord.word.slice(1).length - mixletters.length + hintLetters)),
	);
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
		attempt = (answer.slice(0, hintLetters) + attempt.slice(hintLetters)).slice(0, 7);
	}

	function onWindowKeyUp(e: KeyboardEvent) {
		if (!inputEl) return;
		if (e.target === inputEl || inputEl === document.activeElement) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (!e.detail && !wasKeyboardInput) wasKeyboardInput = true;
		if (e.detail && wasKeyboardInput) wasKeyboardInput = false;
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
			attempt = (
				answer.slice(0, hintLetters) +
				attempt.slice(hintLetters, hintLetters + selectionStart) +
				attempt.slice(hintLetters + selectionEnd)
			).slice(0, 7);
			if (selectionStart < 6) selectionStart++;
			selectionEnd = selectionStart;
			inputEl.setSelectionRange(selectionStart, selectionEnd);
			return;
		}
		if (!e.key.match(/^[A-Za-z]$/)) return;
		const key = e.key.toUpperCase();
		attempt = (
			answer.slice(0, hintLetters) +
			attempt.slice(hintLetters, hintLetters + selectionStart) +
			key +
			attempt.slice(hintLetters + selectionEnd)
		).slice(0, 7);
		if (selectionStart < 6) selectionStart++;
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
			},
		};
	}

	$effect(() => {
		if (success) return;
		if (answer && attempt === answer) {
			if (times[times.length - 1]) times[times.length - 1][1] = Date.now();
			clearInterval(interval);
			localStorage.setItem(
				`scrmbld_${todaysWord.day}`,
				JSON.stringify({
					...todaysWord,
					times,
					success,
					gameplayID,
					gameplayStartSaved,
					gameplayEndSaved,
				}),
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
					{ transform: 'translate3d(0px, 0, 0)' },
				],
				{
					easing: 'ease-in-out',
					duration: 350,
				},
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
					if (!savedInfo.gameplayEndSaved && savedInfo.times?.length) {
						times = savedInfo.times;
					}
					gameplayID = savedInfo.gameplayID;
					gameplayStartSaved = savedInfo.gameplayStartSaved || false;
					gameplayEndSaved = savedInfo.gameplayEndSaved || false;
				}
			} catch (error) {
				// ignore
			}
		}
		untrack(() => {
			if (!gameplayStartSaved) saveGameplayStart();
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
						JSON.stringify({
							...todaysWord,
							times,
							success,
							gameplayID,
							gameplayStartSaved,
							gameplayEndSaved,
						}),
					);
				}, 1000);
			}, 1500);
		});
		return () => clearInterval(interval);
	});

	// Log the gameplay start
	async function saveGameplayStart() {
		const response = await fetch('/api/gameplay', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				word: todaysWord.word[0],
				day: todaysWord.day,
			}),
		});
		if (response.ok) {
			const { uuid } = await response.json<any>();
			gameplayID = uuid;
			gameplayStartSaved = true;
		}
	}

	// Log the gameplay end when the user succeeds
	async function saveGameplayEnd() {
		if (!gameplayID) return;
		localStorage.setItem(
			`scrmbld_${todaysWord.day}`,
			JSON.stringify({
				...todaysWord,
				times,
				success,
				gameplayID,
				gameplayStartSaved,
				gameplayEndSaved: true,
			}),
		);
		const state = JSON.stringify({
			json: { times },
			num_hints: numHintsUsed,
		} as Partial<GamePlay>);
		window.location.href = `/results/${gameplayID}?state=${btoa(state).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
	}

	$effect(() => {
		if (gameplayEndSaved || !gameplayStartSaved || !gameplayID) return;
		if (!success) return;
		saveGameplayEnd();
	});
</script>

<svelte:window onkeyup={onWindowKeyUp} />

<article>
	{#if alreadySolved}
		<a class="already-solved" href="/results/{gameplayID}" data-sveltekit-reload
			>You've already solved today's word. Click to view results.</a
		>
	{/if}
	<div class="answer" bind:this={answerEl}>
		{#if hintLetters}
			<FlipText
				class="hint"
				word={answer.slice(0, hintLetters)}
				duration={wasKeyboardInput ? 100 : 150}
				success
				minLength={hintLetters}
			/>
		{/if}
		<FlipText
			word={attempt.slice(hintLetters)}
			duration={wasKeyboardInput ? 100 : 150}
			{selectionEnd}
			{selectionStart}
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
				const target = e.target as HTMLInputElement;
				selectionEnd = Math.min(target.selectionEnd as number, 7);
				selectionStart = Math.min(target.selectionStart as number, selectionEnd, 6);
				if (selectionStart === selectionEnd && selectionStart === 0) {
					selectionEnd = 1;
					inputEl?.setSelectionRange(selectionStart, selectionEnd);
				}
			}}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				selectionStart = target.selectionStart as number;
				selectionEnd = target.selectionEnd as number;
				const value = target.value;
				let newValue = value.toUpperCase().replace(/[^A-Z]/g, '');
				const numberOfInvaidChars = value.length - newValue.length;
				newValue = newValue.slice(0, 7);
				selectionEnd = Math.min(selectionEnd - numberOfInvaidChars, 7);
				selectionStart = Math.min(selectionStart - numberOfInvaidChars, selectionEnd, 6);
				attempt = (answer.slice(0, hintLetters) + newValue).slice(0, 7);
				if (newValue !== value) {
					target.value = attempt;
					target.setSelectionRange(selectionStart, selectionEnd);
				}
			}}
			onselectionchange={(e) => {
				const target = e.target as HTMLInputElement;
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
		{#if success && !alreadySolved}
			<div style="height: 3.5rem; display: flex; align-items: center; text-align: center;">
				Loading Results...
			</div>
		{:else}
			<button
				disabled={shuffling}
				onclick={() => {
					scrambled = shuffle();
				}}
				use:ripple>Shuffle</button
			>
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
						'9',
					]}
				/>
			</div>
			{@const hintEnabled = time > (mixletters.length ? 60 : 120 + hintLetters * 60)}
			<button
				onclick={() => {
					applyHint();
				}}
				use:ripple
				class="hint"
				disabled={!hintEnabled}
			>
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
	<div class="question">
		<FlipText
			word={scrambled}
			{usedLetters}
			duration={350}
			onclick={(i) => {
				if (usedLetters.has(i)) return;
				if (attempt.length >= answer.length) return;
				const letter = scrambled[i];
				usedLetters.add(i);
				attempt += letter;
				setTimeout(() => {
					if (inputEl) {
						selectionStart = attempt.length;
						selectionEnd = selectionStart;
						inputEl.setSelectionRange(selectionStart, selectionEnd);
					}
				}, 0);
			}}
		/>
	</div>

	{#if attempt.length > hintLetters}
		<button
			class="clear"
			in:slide={{ axis: 'y', easing: quartOut, duration: 300 }}
			out:slide={{ axis: 'y', easing: backIn, duration: 150 }}
			onpointerdown={() => {
				attempt = hintLetters ? answer.slice(0, hintLetters) : '';
			}}
			use:ripple>Clear</button
		>
	{/if}

	<div class="desktop-only" style="margin-top: 1rem;">
		<Keyboard
			onclick={(key) => {
				if (key === 'Clear') {
					attempt = '';
					selectionStart = 0;
					selectionEnd = 0;
					return;
				}
				window.dispatchEvent(new KeyboardEvent('keyup', { key, detail: 1 }));
			}}
		></Keyboard>
	</div>
</article>

<style lang="scss">
	article {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 100vw;
		overflow: hidden;
		min-height: 100vh;
		padding: 8svh 0 6vh;
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
	.desktop-only {
		display: none;
		@media (min-width: 769px) and (min-height: 700px) {
			display: block;
		}
	}
	.already-solved {
		position: fixed;
		top: 0.5rem;
		background-color: rgba(255, 255, 255, 0.05);
		color: #dddddd;
		padding: 0.5rem 1rem;
		border-radius: 999px;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		text-align: center;
		text-wrap: pretty;
		margin: 0 1rem;
	}
	.actions {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		margin: 4svh 0;
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
		// &.primary {
		// 	background-color: #eeeeee;
		// 	color: #333333;
		// 	&:hover {
		// 		background-color: #ffffff;
		// 		color: #000000;
		// 	}
		// }
	}
	.timer {
		font-size: 0.7rem;
		@media (min-width: 350px) {
			font-size: 0.8rem;
		}
		@media (min-width: 400px) {
			font-size: 0.85rem;
		}
		@media (min-width: 600px) {
			font-size: 1rem;
		}
	}
	.clear {
		position: fixed;
		bottom: 1rem;
		background-color: rgba(255, 255, 255, 0.05);
		color: #dddddd;
		padding: 0.5rem 1rem;
		border-radius: 999px;
		text-decoration: none;
		font-size: 2rem;
		font-weight: 500;
		text-align: center;
		text-wrap: pretty;
		z-index: 1;
		width: calc(100vw - 2rem);
		backdrop-filter: blur(10px);
		@media (min-width: 769px) {
			display: none;
		}
	}
	.question {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		font-size: min(7vmin, 5rem);
		margin-bottom: 2rem;

		@media (max-width: 768px) {
			margin-bottom: 0;
			:global(.flip-text) {
				display: grid;
				grid-template-columns: repeat(4, 1fr);
				grid-template-rows: repeat(2, auto);
				font-size: 13vmin;
				margin-top: 2vh;
			}
			:global(.flip-text > button) {
				justify-items: center;
			}
		}
	}
	.answer {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
		font-size: 1.25rem;
		font-size: min(7vmin, 5rem);
		:global(.flip-text) {
			grid-row: 1 / 1;
			grid-column: 2 / 2;
		}
		:global(.flip-text.hint) {
			grid-column: 1 / 1;
		}
		input {
			position: absolute;
			// grid-row: 1 / 1;
			// grid-column: 2 / 2;
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
			padding: 0 0 0 0.075em;
			margin: 0;
			line-height: 1em;
			letter-spacing: 0.2em;
			text-align: left;
			opacity: 0;
		}
	}
</style>
