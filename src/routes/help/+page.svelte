<script lang="ts">
	import FlipText from '$lib/FlipText.svelte';
	import { ripple } from '$lib/ripple';
	import Confetti from 'svelte-confetti';
	import { SvelteSet } from 'svelte/reactivity';
	let numSolved = $state(0);
	let result = $state('');
	let success = $state(false);
	let time = $state(0); // Number of seconds since the start of the game
	const answer = 'SCRMBLD';
	const question = 'LMRDSCBX';

	const usedLetters = new SvelteSet<number>();
	let destroyed = false;
	async function solveNext() {
		if (numSolved >= answer.length) return;
		numSolved++;
		result = answer.slice(0, numSolved);
		usedLetters.add(question.indexOf(answer[numSolved - 1]));
		if (!destroyed) {
			await new Promise((r) => setTimeout(r, 2500));
			if (numSolved === answer.length) {
				await new Promise((r) => setTimeout(r, 100));
				success = true;
				return;
			}
			solveNext();
		}
	}
	setTimeout(() => {
		solveNext();
	}, 5000);

	$effect(() => {
		const interval = setInterval(() => {
			time++;
		}, 1000);
		return () => {
			clearInterval(interval);
			destroyed = true;
		};
	});

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
</script>

{#if success}
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
<div class="container">
	<h1>How to Play</h1>

	<section>
		<p>
			You are given <strong>8&nbsp;scrambled&nbsp;letters</strong>.
		</p>
		<div class="demo">
			<FlipText
				word={question}
				minLength={8}
				{usedLetters}
				sound
				alphabet={[
					'',
					'@',
					'#',
					'+',
					'=',
					'?',
					':',
					...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
					'!',
				]}
			/>
		</div>
	</section>

	<section>
		<p>
			Find the hidden <strong>7-letter&nbsp;word</strong>.
		</p>
		<div class="demo">
			<FlipText word={result} minLength={7} {success} sound />
		</div>
	</section>

	<section>
		<p>
			Tap the letters on the board to type. No keyboard required. Use a <span class="fake-button"
				>hint</span
			>
			or <span class="fake-button">shuffle</span> the letters if you get stuck. But hurry, you are on
			the clock!
		</p>
		<div class="timer">
			<FlipText
				word={timeDisplay}
				minLength={4}
				duration={200}
				volume={0.65}
				sound
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
	</section>

	<div class="actions">
		<a href="/" class="button" use:ripple>Back to Game</a>
	</div>
</div>

<style lang="scss">
	.confetti {
		position: fixed;
		bottom: 0;
		left: 50%;
	}
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem 1rem;
		max-width: 500px;
		margin: 0 auto;
		text-align: center;
		gap: 2.5rem;
		min-height: 100vh;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		text-transform: uppercase;
		border-bottom: 2px solid #eeeeee;
	}

	section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		width: 100%;
	}

	p {
		font-size: 1.2rem;
		line-height: 1.4;
		margin: 0;
		max-width: 50ch;
		text-wrap: pretty;
		.fake-button {
			display: inline-block;
			padding: 0.05rem 0.3rem;
			font-size: 0.9em;
			background-color: rgb(255 255 255 / 0.15);
			border-radius: 4px;
			font-weight: 600;
			user-select: none;
		}
	}

	strong {
		color: #4ade80; /* A nice green to highlight key terms, or just keep white/bold */
		color: inherit;
		font-weight: 700;
		text-decoration: underline;
		text-decoration-color: #666;
	}

	.demo {
		/* FlipText can be wide, ensure it fits */
		width: 100%;
		display: flex;
		justify-content: center;
		pointer-events: none; /* Static demo */
		transform-origin: center;
		font-size: min(7vmin, 3rem);
	}

	.timer {
		font-size: 1.25rem;
		margin-top: 1rem;
	}

	.actions {
		position: fixed;
		bottom: 1.5rem;
		z-index: 10;
	}

	.button {
		display: inline-block;
		padding: 1rem 2rem;
		background-color: #eeeeee;
		color: #444444;
		text-decoration: none;
		font-weight: bold;
		border-radius: 4px;
		font-size: 1.5rem;
		transition:
			transform 0.1s,
			opacity 0.2s;
		box-shadow: 0 4px 0 #999999;
		-webkit-tap-highlight-color: transparent;

		&:active {
			transform: translateY(4px);
			box-shadow: none;
		}

		&:hover {
			opacity: 0.9;
		}
	}
</style>
