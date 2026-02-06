<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Expand from '$lib/Expand.svelte';
	import FlipText from '$lib/FlipText.svelte';
	import BottomNav from '$lib/BottomNav.svelte';
	import StreakCelebration from '$lib/StreakCelebration.svelte';
	import { tooltip } from '$lib/tootltip';
	import { SvelteSet } from 'svelte/reactivity';
	import { ACHIEVEMENT_MAP } from '$lib/achievements';

	const { data } = $props();

	// Get layout data for bottom nav
	const layoutData = $derived(page.data);
	const copiedTextToClipboard = new SvelteSet<string>();
	let shareButtonEl = $state<HTMLButtonElement | undefined>(undefined);
	let showConfetti = $state(false);
	let viewDetailedResults = $state(false);
	let signInBannerDismissed = $state(false);
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
	const shareImageUrl = $derived.by(() => {
		const url = new URL(page.url.href);
		url.pathname = `/api/share/${data.gameplayId}.png`;
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

<svelte:head>
	<meta property="og:title" content="SCRMBLD - {getTimeDisplay(data.time)}" />
	<meta
		property="og:description"
		content="I solved SCRMBLD in {getTimeDisplay(data.time)}. Can you beat my time?"
	/>
	<meta property="og:image" content={shareImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={shareImageUrl} />
</svelte:head>

<article class:has-nav={layoutData.session}>
	{#if showConfetti && data.isCurrentUser}
		<StreakCelebration
			streak={data.userStreak}
			show={showConfetti}
			onfinish={() => (showConfetti = false)}
		/>
	{/if}
	{#if data.newAchievements && data.newAchievements.length > 0 && data.isCurrentUser}
		<div class="achievements-unlocked">
			<h2>Achievement{data.newAchievements.length > 1 ? 's' : ''} Unlocked!</h2>
			<div class="achievement-list">
				{#each data.newAchievements as achievementId, i}
					{@const achievement = ACHIEVEMENT_MAP[achievementId]}
					{#if achievement}
						<div class="achievement" style="animation-delay: {i * 150}ms">
							<span class="achievement-icon">{achievement.icon}</span>
							<div class="achievement-info">
								<span class="achievement-name">{achievement.name}</span>
								<span class="achievement-desc">{achievement.description}</span>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
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
								{@const daysSinceMonday = (new Date(data.day).getUTCDay() + 6) % 7}
								{@const day = data.day - (daysSinceMonday - 6 + (i * 7 + j)) * 24 * 60 * 60 * 1000}
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
									<!-- Days are displayed right-to-left: j=0 is Sunday (end of week), j=6 is Monday (start of week)
								{#if j === 0}
									Su
								{:else if j === 1}
									Sa
								{:else if j === 2}
									F
								{:else if j === 3}
									Th
								{:else if j === 4}
									W
								{:else if j === 5}
									Tu
								{:else if j === 6}
									M
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
		<button class="primary two-line" onclick={() => share('text')} bind:this={shareButtonEl}>
			{#if copiedTextToClipboard.has(shareText)}
				Copied to Clipboard!
			{:else}
				Share Score
			{/if}
			<small style="letter-spacing: 2px;">{shareText}</small>
		</button>
		<button class="two-line" onclick={() => share('url')} bind:this={shareButtonEl}>
			{#if copiedTextToClipboard.has(shareURL)}
				Copied to Clipboard!
			{:else}
				Share Link
			{/if}
			<small>{shareURL}</small>
		</button>
		<!-- <a
			class="button two-line"
			href="/api/share/{data.gameplayId}.png"
			download="scrmbld-{getTimeDisplay(data.time).replace(':', '-')}.png"
		>
			Download Image
			<small>Share on social media</small>
		</a> -->
	{/if}
</article>

{#if !layoutData.session && data.isCurrentUser && !signInBannerDismissed}
	<div class="sign-in-banner">
		<button class="dismiss" onclick={() => (signInBannerDismissed = true)} aria-label="Dismiss">
			&times;
		</button>
		<p>Sign in to track your streak, compete with friends, and save your stats!</p>
		<a href="/signin?from=results" class="sign-in-btn">Sign In</a>
	</div>
{/if}

{#if layoutData.session}
	<BottomNav
		userId={layoutData.session?.user?.id}
		username={layoutData.session?.user?.username}
		todayGameplayId={layoutData.todayGameplayId}
	/>
{/if}

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
		padding: 2rem 0 4rem;
		:global(.my-time) {
			font-size: 2.5rem;
		}
		@media (min-width: 768px) {
			padding: 2rem 0;
			:global(.my-time) {
				font-size: 3.5rem;
			}
		}
		&.has-nav {
			padding-bottom: calc(5rem + env(safe-area-inset-bottom));

			@media (min-width: 768px) {
				padding-bottom: 1rem;
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
		border-radius: 4px;
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
		transition:
			transform 0.07s,
			opacity 0.2s;
		box-shadow: 0 4px 0 #333333;
		touch-action: manipulation;
		&:active {
			transform: translateY(4px);
			box-shadow: none;
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
			box-shadow: 0 4px 0 #999999;
			&:hover {
				background-color: #ffffff;
				color: #000000;
			}
		}
		&.two-line {
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
		&.secondary {
			background-color: transparent;
			color: #bbbbbb;
			border: 1px solid #555555;
			box-shadow: none;
			font-size: 1rem;
			&:hover {
				color: #eeeeee;
				border-color: #888888;
			}
			&:active {
				transform: translateY(2px);
			}
		}
	}

	.account-link {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #444444;
	}

	.achievements-unlocked {
		margin: 1.5rem 0;
		padding: 1rem;
		background: rgba(2, 207, 183, 0.1);
		border: 1px solid rgba(2, 207, 183, 0.3);
		border-radius: 8px;
		text-align: center;
		width: calc(100vw - 2rem);
		max-width: 400px;
		box-sizing: border-box;

		h2 {
			font-size: 1rem;
			font-weight: 500;
			margin: 0 0 0.75rem;
			color: #02cfb7;
		}
	}

	.achievement-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.achievement {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 6px;
		animation: achievementPop 0.4s ease-out backwards;
	}

	@keyframes achievementPop {
		from {
			opacity: 0;
			transform: scale(0.8) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.achievement-icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	.achievement-info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		text-align: left;
	}

	.achievement-name {
		font-size: 0.95rem;
		font-weight: 500;
		color: #eeeeee;
	}

	.achievement-desc {
		font-size: 0.8rem;
		color: #bbbbbb;
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

	.sign-in-banner {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background-color: #333333;
		border-top: 1px solid #555555;
		padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom)) 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		z-index: 100;
		animation: slideUp 0.3s ease-out;

		p {
			margin: 0;
			font-size: 0.8rem;
			color: #bbbbbb;
			flex: 1;
			line-height: 1.3;
			text-wrap: pretty;
		}

		.sign-in-btn {
			flex-shrink: 0;
			display: inline-block;
			width: auto;
			max-width: none;
			background-color: #eeeeee;
			color: #333333;
			font-family: 'Roboto Mono', monospace;
			font-size: 0.85rem;
			font-weight: 500;
			padding: 0.5em 1em;
			border-radius: 4px;
			border: none;
			box-shadow: 0 4px 0 #999999;
			text-decoration: none;
			white-space: nowrap;
			margin: 0;
			transition: transform 0.07s;

			&:hover {
				background-color: #ffffff;
				color: #000000;
			}
			&:active {
				transform: translateY(4px);
				box-shadow: none;
			}
		}

		.dismiss {
			flex-shrink: 0;
			width: auto;
			max-width: none;
			background: none;
			border: none;
			box-shadow: none;
			color: #888888;
			font-size: 1.25rem;
			cursor: pointer;
			padding: 0;
			line-height: 1;

			&:hover {
				color: #eeeeee;
			}
			&:active {
				transform: none;
			}
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>
