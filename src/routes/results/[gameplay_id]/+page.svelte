<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Expand from '$lib/Expand.svelte';
	import FlipText from '$lib/FlipText.svelte';
	import { tooltip } from '$lib/tootltip';
	import Confetti from 'svelte-confetti';
	import { SvelteSet } from 'svelte/reactivity';

	const { data } = $props();
	const copiedTextToClipboard = new SvelteSet<string>();
	let shareButtonEl = $state<HTMLButtonElement | undefined>(undefined);
	let showConfetti = $state(false);
	let viewDetailedResults = $state(false);
	const useNativeShare = $derived(
		browser &&
			typeof navigator !== undefined &&
			'share' in navigator &&
			!navigator.userAgent.includes('Windows'),
	);
	const shareText = $derived(
		`🆂🅲🆁🅼🅱🅻🅳`.slice(0, data.numHintsUsed * 2) +
			`🅂🄲🅁🄼🄱🄻🄳`.slice(data.numHintsUsed * 2) +
			` ⏲${getTimeDisplay(data.time)}`,
	);
	const shareURL = $derived.by(() => {
		const url = new URL(page.url.href);
		url.search = '';
		url.hash = '';
		return url.href;
	});
	const firstUserResult = $derived(Math.min(...Object.keys(data.userHistory).map((day) => +day)));
	const numStreakWeeks = $derived(
		Math.max(12, Math.min(52, Math.ceil((data.day - firstUserResult) / (7 * 24 * 60 * 60 * 1000)))),
	);
	const alphabet = [
		'',
		'@',
		'#',
		'+',
		'=',
		'?',
		...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
		':',
		...Array.from({ length: 10 }, (_, i) => String.fromCharCode(48 + i)),
		' ',
	];

	function getTimeDisplay(ms: number) {
		const time = Math.round((ms ?? 0) / 1000); // Convert milliseconds to seconds
		const hours = Math.floor(time / 3600);
		const minutes = Math.floor((time % 3600) / 60);
		const seconds = time % 60;
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
				.toString()
				.padStart(2, '0')}`;
		}
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function openNativeShare(text?: string, url?: string) {
		if (!useNativeShare || typeof navigator === 'undefined' || !navigator.share) return;
		navigator.share({
			title: '🅂🄲🅁🄼🄱🄻🄳',
			text,
			url,
		});
	}

	function shareToClipboard(text = shareText) {
		if (typeof navigator === 'undefined') return;
		navigator.clipboard.writeText(text);
		copiedTextToClipboard.add(text);
	}

	let clipboardTimeout: ReturnType<typeof setTimeout> | undefined;
	function share(type: 'text' | 'url') {
		if (useNativeShare) {
			openNativeShare(shareText, type === 'url' ? shareURL : undefined);
		} else {
			shareToClipboard(type === 'text' ? shareText : shareURL);
			if (clipboardTimeout) clearTimeout(clipboardTimeout);
			clipboardTimeout = setTimeout(() => {
				copiedTextToClipboard.clear();
			}, 5000);
		}
	}

	$effect(() => {
		if (page.url.searchParams.has('state')) {
			const newUrl = new URL(page.url.href);
			newUrl.searchParams.delete('state');
			goto(newUrl.href, {
				replaceState: true,
				noScroll: true,
				keepFocus: true,
				invalidateAll: false,
			});
		}
	});

	$effect(() => {
		if (data.isCurrentUser) {
			setTimeout(() => {
				showConfetti = true;
			}, 1500);
		}
	});
</script>

<article>
	{#if showConfetti}
		<!-- <div class="confetti">
			<Confetti
				colorRange={[120, 250]}
				x={[-5, 5]}
				y={[0, 8]}
				amount={200}
				destroyOnComplete
				disableForReducedMotion
				rounded
				duration={4000}
				fallDistance="200px"
				iterationCount={1}
			/>
		</div> -->
	{/if}
	<h1>
		{#if data.isCurrentUser}
			You solved SCRMBLD
		{:else}
			Your friend solved SCRMBLD
		{/if}
		{#if data.numHintsUsed > 0}
			<small style="display: block;">
				(using {data.numHintsUsed}
				{data.numHintsUsed === 1 ? 'hint' : 'hints'})
			</small>
		{/if}
	</h1>
	<FlipText
		success
		word={getTimeDisplay(data.time)}
		minLength={4}
		class="my-time"
		duration={400}
		{alphabet}
	></FlipText>

	<div class="details">
		<Expand show={viewDetailedResults}>
			<div style="margin-right: -2px;">
				<div class="detail" style="padding: 3px 2px;">
					<span class="label">Today</span>
					<FlipText
						word={new Date(data.day).toLocaleDateString(undefined, {
							timeZone: 'UTC',
							dateStyle: 'short',
						})}
						alphabet={[
							'',
							'@',
							'#',
							'+',
							'=',
							'?',
							':',
							...Array.from({ length: 10 }, (_, i) => String.fromCharCode(48 + i)),
							'/',
						]}
						minLength={0}
						duration={300}
					></FlipText>
				</div>
			</div>
		</Expand>
		{#if data.isCurrentUser}
			<Expand show={viewDetailedResults}>
				<div style="margin-right: -2px;">
					<div class="detail" style="padding: 3px 2px;">
						<span class="label">Word</span>
						<FlipText word={data.word} minLength={0} duration={300}></FlipText>
					</div>
				</div>
			</Expand>
		{/if}
		<div class="detail">
			<span class="label">Today's Average</span>
			<FlipText
				word={getTimeDisplay(data.averageForDay || 0)}
				minLength={0}
				duration={300}
				{alphabet}
			></FlipText>
		</div>
		<div class="detail">
			<span class="label">Today's Fastest Time</span>
			<FlipText word={getTimeDisplay(data.fastestTime || 0)} minLength={0} duration={300} {alphabet}
			></FlipText>
		</div>
		<div class="detail">
			{#if data.isCurrentUser}
				<span class="label">My Weekly Average</span>
			{:else}
				<span class="label">Friend's Weekly Average</span>
			{/if}
			<FlipText
				word={getTimeDisplay(data.userWeeklyAverage || 0)}
				minLength={0}
				duration={300}
				{alphabet}
			></FlipText>
		</div>
		<div class="detail">
			{#if data.isCurrentUser}
				<span class="label">My Streak</span>
			{:else}
				<span class="label">Friend's Streak</span>
			{/if}
			<FlipText word={`${data.userStreak}`.padStart(4, ' ')} minLength={0} duration={300} {alphabet}
			></FlipText>
		</div>
	</div>

	{#if data.userHistory}
		<Expand show={viewDetailedResults}>
			<div>
				<div class="streak">
					{#each { length: numStreakWeeks } as _, i}
						<div class="week">
							{#each { length: 7 } as _, j}
								{@const dayOfWeek = new Date(data.day).getUTCDay()}
								{@const day = data.day - (dayOfWeek - 6 + (i * 7 + j)) * 24 * 60 * 60 * 1000}
								{@const result = data.userHistory[`${day}`]}
								{@const date = new Date(day).toLocaleDateString(undefined, {
									timeZone: 'UTC',
									dateStyle: 'short',
								})}
								<span
									class="day"
									class:today={day === data.day}
									class:future={day > data.day}
									class:success={!!result}
									class:attempted={result !== undefined}
									use:tooltip={result === undefined
										? date
										: result
											? `${date} - Solved in ${getTimeDisplay(result)}`
											: `${date} - Failed to solve`}
								>
									<!-- {#if j === 0}
									S
								{:else if j === 1}
									F
								{:else if j === 2}
									T
								{:else if j === 3}
									W
								{:else if j === 4}
									T
								{:else if j === 5}
									M
								{:else if j === 6}
									S
								{/if} -->
								</span>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</Expand>
	{/if}

	<Expand show={!viewDetailedResults}>
		<div>
			<button class="button" onclick={() => (viewDetailedResults = true)}>
				Detailed Results
			</button>
		</div>
	</Expand>
	{#if !data.isCurrentUser}
		<p style="max-width: 350px; text-align: center; margin: 1rem auto 1.5rem; text-wrap: balance;">
			Now it's <i>your</i> turn. Find the 7 letter word in 8 scrambled letters.
		</p>
		<a class="button primary" href="/play" data-sveltekit-reload>Play</a>
	{/if}
	{#if data.isCurrentUser}
		<button class="primary share" onclick={() => share('text')} bind:this={shareButtonEl}>
			{#if copiedTextToClipboard.has(shareText)}
				Copied to Clipboard!
			{:else}
				Share Score
			{/if}
			<small style="letter-spacing: 2px;">{shareText}</small>
		</button>
		<button class="share" onclick={() => share('url')} bind:this={shareButtonEl}>
			{#if copiedTextToClipboard.has(shareURL)}
				Copied to Clipboard!
			{:else}
				Share Link
			{/if}
			<small>{shareURL}</small>
		</button>
	{/if}
</article>

<style>
	/* .confetti {
		position: fixed;
		bottom: 0;
		left: 50%;
	} */
	article {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 100vw;
		overflow: hidden;
		min-height: 100vh;
		padding: 4rem 0;
		:global(.my-time) {
			font-size: 2.5rem;
		}
		@media (min-width: 768px) {
			justify-content: center;
			padding: 0;
			:global(.my-time) {
				font-size: 3.5rem;
			}
		}
	}
	h1 {
		font-weight: normal;
		font-size: 1.25rem;
		margin: 0 0 2rem;
		text-align: center;
		small {
			font-size: 0.9rem;
		}
	}
	.details {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0;
		margin: 2rem 0 2rem;
		.detail {
			display: flex;
			align-items: center;
			gap: 1rem;
			margin-top: 1rem;
			:global(.flip-text) {
				display: inline-flex;
			}
		}
	}
	button,
	.button {
		-webkit-tap-highlight-color: transparent;
		position: relative;
		cursor: pointer;
		font-size: 1.35rem;
		text-decoration: none;
		border-radius: 20px;
		padding: 0.5em 1em;
		margin: 0 0 0.75rem;
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
		width: calc(100vw - 2rem);
		max-width: 400px;
		text-align: center;
		box-sizing: border-box;
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
		&.share {
			display: flex;
			flex-direction: column;
			align-items: center;
			small {
				width: 80%;
				font-size: 0.8rem;
				opacity: 0.6;
				font-weight: normal;
				text-overflow: ellipsis;
				overflow: hidden;
				white-space: nowrap;
			}
		}
	}

	.streak {
		display: flex;
		align-items: center;
		flex-direction: row-reverse;
		justify-content: center;
		width: calc(100vw - 1rem);
		max-width: 700px;
		gap: 2px;
		padding: 0 1rem;
		margin-bottom: 1.5rem;
		z-index: 1;
		.week {
			display: flex;
			flex-direction: column-reverse;
			align-items: center;
			flex: 1;
			gap: 2px;
			max-width: 25px;
		}
		.day {
			aspect-ratio: 0.9;
			background-color: #5c5c5c;
			width: 100%;
			border-radius: 10%;
			font-weight: bold;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 0.8rem;
			transition: color 150ms ease;
			user-select: none;
			color: transparent;
			color: #777777;
			&:hover {
				color: #cccccc;
			}
			&.future {
				opacity: 0.5;
			}
			&.today {
				outline: solid 2px #bbbbbb;
				outline-offset: 1px;
				z-index: 2;
			}
			&.attempted:not(.success) {
				background-color: #ef6262;
				color: #ffffff;
			}
			&.success {
				background-color: #00b7a1;
				color: #ffffff;
			}
		}
	}
</style>
