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
	import { SvelteSet } from 'svelte/reactivity';

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
	let scrambled = $state(shuffle());
	let attempt = $state('');
	let selectionStart = $state(0);
	let selectionEnd = $state(0);
	let times = $state<number[][]>([]);
	let hintLetters = $state(0);
	let wasKeyboardInput = $state(false);
	let gameplayID = $state<string | undefined>(undefined);
	let gameplayStartSaved = $state(false);
	let gameplayEndSaved = $state(false);
	let muted = $state(data.mutedPreference ?? false);
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

	// The indexes of the letters that have been clicked on in the scrambled word
	// This is used to show the correct 'usedLetters' when a user clicks a second instance of a letter
	// This isn't necessary for when the user uses the keyboard to type because we can just show the first instance as 'used'
	const clickedLetterIndexes = new SvelteSet<number>();

	// Determine the used letters based on the attempt and the scrambled word
	const usedLetters = $derived.by(() => {
		const letterIndexes = new Set<number>();
		attempt.split('').forEach((letter, i) => {
			untrack(() => {
				const occurrences = scrambled
					.split('')
					.map((l, j) => (l === letter ? j : -1))
					.filter((j) => j > -1 && !letterIndexes.has(j))
					.sort((a, b) => +clickedLetterIndexes.has(b) - +clickedLetterIndexes.has(a));
				if (occurrences.length) letterIndexes.add(occurrences[0]);
			});
		});
		return letterIndexes;
	});
	const numHintsUsed = $derived(
		Math.max(0, Math.min(7, todaysWord.word.slice(1).length - mixletters.length + hintLetters)),
	);

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

	// Clear the clickedLetterIndexes set when letters that were previously clicked are no longer in the attempt
	$effect(() => {
		const attemptLength = attempt.length;
		untrack(() => {
			Array.from(clickedLetterIndexes).forEach((i) => {
				if (attemptLength <= i) clickedLetterIndexes.delete(i);
			});
		});
	});

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
				sound={!muted}
				success
				minLength={hintLetters}
			/>
		{/if}
		<FlipText
			word={attempt.slice(hintLetters)}
			duration={wasKeyboardInput ? 100 : 150}
			sound={!muted}
			volume={0.75}
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
					sound={!muted}
					volume={0.65}
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
			sound={!muted}
			onclick={(i) => {
				if (usedLetters.has(i)) return;
				if (attempt.length >= answer.length) return;
				const letter = scrambled[i];
				clickedLetterIndexes.add(i);
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
		<div
			class="bottom-actions"
			in:slide={{ axis: 'y', easing: quartOut, duration: 300 }}
			out:slide={{ axis: 'y', easing: backIn, duration: 150 }}
		>
			<button
				onpointerdown={() => {
					attempt = attempt.slice(0, -1);
				}}
				use:ripple
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="m11.4 16l2.6-2.6l2.6 2.6l1.4-1.4l-2.6-2.6L18 9.4L16.6 8L14 10.6L11.4 8L10 9.4l2.6 2.6l-2.6 2.6zM9 20q-.475 0-.9-.213t-.7-.587L2 12l5.4-7.2q.275-.375.7-.587T9 4h11q.825 0 1.413.587T22 6v12q0 .825-.587 1.413T20 20z"
					/></svg
				>
				Backspace
			</button>
			<button
				onpointerdown={() => {
					attempt = hintLetters ? answer.slice(0, hintLetters) : '';
				}}
				use:ripple
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="m8.4 17l3.6-3.6l3.6 3.6l1.4-1.4l-3.6-3.6L17 8.4L15.6 7L12 10.6L8.4 7L7 8.4l3.6 3.6L7 15.6zm3.6 5q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"
					/></svg
				>
				Clear
			</button>
		</div>
	{:else}
		<button
			class="mute"
			onpointerdown={() => {
				muted = !muted;
				document.cookie = `scrmbld_muted=${muted}; path=/`;
			}}
			use:ripple
			title={muted ? 'Unmute' : 'Mute'}
			in:slide={{ axis: 'y', easing: quartOut, duration: 300 }}
			out:slide={{ axis: 'y', easing: backIn, duration: 150 }}
		>
			{#if muted}
				<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="m19.8 22.6l-3.025-3.025q-.625.4-1.325.688t-1.45.462v-2.05q.35-.125.688-.25t.637-.3L12 14.8V20l-5-5H3V9h3.2L1.4 4.2l1.4-1.4l18.4 18.4zm-.2-5.8l-1.45-1.45q.425-.775.638-1.625t.212-1.75q0-2.35-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975q0 1.325-.363 2.55T19.6 16.8m-3.35-3.35L14 11.2V7.95q1.175.55 1.838 1.65T16.5 12q0 .375-.062.738t-.188.712M12 9.2L9.4 6.6L12 4z"
					/></svg
				>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="M14 20.725v-2.05q2.25-.65 3.625-2.5t1.375-4.2t-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975t-1.95 5.613T14 20.725M3 15V9h4l5-5v16l-5-5zm11 1V7.95q1.175.55 1.838 1.65T16.5 12q0 1.275-.663 2.363T14 16"
					/></svg
				>
			{/if}
		</button>
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
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		text-align: center;
		text-wrap: pretty;
		margin: 0 1rem;
		+ .answer {
			@media (max-width: 768px) {
				margin-top: 2rem;
			}
		}
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
		border-radius: 4px;
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
		touch-action: manipulation;
		transition:
			transform 0.07s,
			opacity 0.2s;
		box-shadow: 0 4px 0 #333333;
		&:active {
			transform: translateY(4px);
			box-shadow: none;
		}
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
	.mute {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		background-color: rgba(255, 255, 255, 0.05);
		color: #dddddd;
		padding: 0;
		border-radius: 999px;
		text-align: center;
		z-index: 1;
		backdrop-filter: blur(10px);
		width: 4rem;
		height: 4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}
	.bottom-actions {
		position: fixed;
		display: flex;
		gap: 0.5rem;
		bottom: 0.5rem;
		left: 0.5rem;
		right: 0.5rem;
		@media (min-width: 769px) {
			display: none;
		}
		@media (min-width: 400px) {
			gap: 1rem;
			bottom: 1rem;
			left: 1rem;
			right: 1rem;
		}

		button {
			background-color: rgba(255, 255, 255, 0.05);
			color: #dddddd;
			padding: 0.75rem 0.5rem;
			border-radius: 4px;
			text-decoration: none;
			font-weight: 500;
			text-align: center;
			text-wrap: pretty;
			z-index: 1;
			backdrop-filter: blur(10px);
			width: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			font-size: 1.2rem;
			touch-action: manipulation;
			@media (min-width: 400px) {
				font-size: 1.5rem;
				padding: 0.75rem 1rem;
			}
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
		@media (max-width: 768px) {
			pointer-events: none;
		}
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
