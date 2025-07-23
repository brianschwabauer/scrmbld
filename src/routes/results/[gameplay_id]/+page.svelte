<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { assets } from '$app/paths';
	import { page } from '$app/state';
	import FlipText from '$lib/FlipText.svelte';
	import Popover from '$lib/Popover.svelte';
	import { ripple } from '$lib/ripple';
	import { tooltip } from '$lib/tootltip';
	import Confetti from 'svelte-confetti';
	import { SvelteSet } from 'svelte/reactivity';

	const { data } = $props();
	const copiedTextToClipboard = new SvelteSet<string>();
	let shareButtonEl = $state<HTMLButtonElement | undefined>(undefined);
	let showConfetti = $state(false);
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

	function openNativeShare() {
		if (!useNativeShare || typeof navigator === 'undefined' || !navigator.share) return;
		navigator.share({
			title: '🅂🄲🅁🄼🄱🄻🄳',
			text: shareText,
			url: shareURL,
		});
	}

	function shareOnTwitter(text = shareText, url = shareURL) {
		const twitterUrl = new URL(`https://twitter.com/intent/tweet`);
		twitterUrl.searchParams.set('text', text);
		if (url) twitterUrl.searchParams.set('url', url);
		window.open(twitterUrl.href, '_blank');
	}

	function shareOnFacebook(text = shareText, url = shareURL) {
		const twitterUrl = new URL(`https://www.facebook.com/share.php`);
		twitterUrl.searchParams.set('[title]', text);
		if (url) twitterUrl.searchParams.set('u', url);
		window.open(twitterUrl.href, '_blank');
	}

	function shareToClipboard(text = shareText) {
		if (typeof navigator === 'undefined') return;
		navigator.clipboard.writeText(text);
		copiedTextToClipboard.add(text);
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
		<div class="confetti">
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
		duration={500}
		{alphabet}
	></FlipText>

	<div class="details">
		<div class="detail">
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
				onlyAnimateOneLetter
			></FlipText>
		</div>
		{#if data.isCurrentUser}
			<div class="detail">
				<span class="label">Word</span>
				<FlipText word={data.word} minLength={0} duration={300} onlyAnimateOneLetter></FlipText>
			</div>
		{/if}
		<div class="detail">
			<span class="label">Today's Average</span>
			<FlipText
				word={getTimeDisplay(data.averageForDay || 0)}
				minLength={0}
				duration={300}
				onlyAnimateOneLetter
				{alphabet}
			></FlipText>
		</div>
		<div class="detail">
			<span class="label">Today's Fastest Time</span>
			<FlipText
				word={getTimeDisplay(data.fastestTime || 0)}
				minLength={0}
				duration={300}
				onlyAnimateOneLetter
				{alphabet}
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
				onlyAnimateOneLetter
				{alphabet}
			></FlipText>
		</div>
	</div>

	{#if !data.isCurrentUser}
		<p style="max-width: 350px; text-align: center; margin: 1rem auto 1.5rem; text-wrap: balance;">
			Now it's <i>your</i> turn. Find the 7 letter word in 8 scrambled letters.
		</p>
		<a class="button primary" href="/play" data-sveltekit-reload>Play</a>
	{/if}
	{#if data.isCurrentUser}
		<button class="primary" onclick={openNativeShare} bind:this={shareButtonEl}>Share</button>
		{#if !useNativeShare}
			<Popover refElement={shareButtonEl} openOnClick>
				<div class="share-popover">
					<label for="share-url">Share Results URL</label>
					<div class="share-result">
						<input type="text" readonly value={shareURL} id="share-url" />
						<div class="buttons">
							<button
								onclick={() => shareToClipboard(shareURL)}
								aria-label="Copy share url"
								use:tooltip={copiedTextToClipboard.has(shareURL)
									? 'Copied url to clipboard!'
									: 'Copy url to clipboard'}
								use:ripple
							>
								{#if copiedTextToClipboard.has(shareURL)}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="1em"
										height="1em"
										viewBox="0 0 24 24"
										><path
											fill="currentColor"
											d="m10.6 16.6l7.05-7.05l-1.4-1.4l-5.65 5.65l-2.85-2.85l-1.4 1.4zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"
										/></svg
									>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="1em"
										height="1em"
										viewBox="0 0 24 24"
										><path
											fill="currentColor"
											d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm-4 4q-.825 0-1.412-.587T3 20V6h2v14h11v2z"
										></path></svg
									>
								{/if}
							</button>
							<button
								onclick={() => shareOnTwitter(shareText, shareURL)}
								class="twitter"
								use:tooltip={'Share url on Twitter/X'}
								use:ripple
							>
								<img src="{assets}/x.svg" alt="Twitter Logo" />
							</button>
							<button
								onclick={() => shareOnFacebook(shareText, shareURL)}
								class="facebook"
								use:tooltip={'Share url on Facebook'}
								use:ripple
							>
								<img src="{assets}/facebook.png" alt="Facebook Logo" />
							</button>
						</div>
					</div>
					<label for="share-text">Share Results Text</label>
					<div class="share-result">
						<input type="text" readonly value={shareText} id="share-text" />
						<div class="buttons">
							<button
								onclick={() => shareToClipboard(shareText)}
								aria-label="Copy share text"
								use:tooltip={copiedTextToClipboard.has(shareText)
									? 'Copied score to clipboard!'
									: 'Copy score to clipboard'}
								use:ripple
							>
								{#if copiedTextToClipboard.has(shareText)}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="1em"
										height="1em"
										viewBox="0 0 24 24"
										><path
											fill="currentColor"
											d="m10.6 16.6l7.05-7.05l-1.4-1.4l-5.65 5.65l-2.85-2.85l-1.4 1.4zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"
										/></svg
									>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="1em"
										height="1em"
										viewBox="0 0 24 24"
										><path
											fill="currentColor"
											d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm-4 4q-.825 0-1.412-.587T3 20V6h2v14h11v2z"
										></path></svg
									>
								{/if}
							</button>
							<button
								onclick={() => shareOnTwitter(shareText, '')}
								class="twitter"
								use:tooltip={'Share score on Twitter/X'}
								use:ripple
							>
								<img src="{assets}/x.svg" alt="Twitter Logo" />
							</button>
							<button
								onclick={() => shareOnFacebook(shareText, '')}
								class="facebook"
								use:tooltip={'Share score on Facebook'}
								use:ripple
							>
								<img src="{assets}/facebook.png" alt="Facebook Logo" />
							</button>
						</div>
					</div>
				</div>
			</Popover>
		{/if}
	{/if}
</article>

<style>
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
		gap: 1rem;
		margin: 2rem 0 2rem;
		.detail {
			display: flex;
			align-items: center;
			gap: 1rem;
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
		font-size: 1.5rem;
		text-decoration: none;
		border-radius: 999px;
		padding: 0.5em 1em;
		margin: 0 0 4rem;
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
	.share-popover {
		color: #333333;
		padding: 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		@media (min-width: 600px) {
			padding: 2rem;
		}

		label {
			margin-bottom: 0.5rem;
			&:not(:first-child) {
				margin-top: 2rem;
			}
		}
		.share-result {
			display: flex;
			flex-direction: row;
			align-items: center;
			gap: 0.5rem;
			input {
				font-size: 1.1rem;
				width: 100%;
				max-width: 20rem;
				padding: 0.5rem;
				border-radius: 0.25rem;
				border: none;
				background-color: #eeeeee;
				color: #333333;
				font-family: 'Roboto Mono', monospace;
				font-optical-sizing: auto;
				font-weight: 400;
				font-style: normal;
			}
		}
		.buttons {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}
		button {
			width: 2.5rem;
			height: 2.5rem;
			border-radius: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0;
			margin: 0;
			background-color: #eeeeee;
			color: #333333;
			@media (min-width: 600px) {
				width: 3rem;
				height: 3rem;
			}
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
