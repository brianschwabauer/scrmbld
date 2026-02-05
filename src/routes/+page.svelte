<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import FlipText from '$lib/FlipText.svelte';

	const { data } = $props();

	// Get layout data (includes todayGameplayId)
	const layoutData = $derived(page.data);

	// Show streak-at-risk warning after 6 PM local time if user hasn't played today
	const isLateInDay = $derived.by(() => {
		if (!browser) return false;
		const hour = new Date().getHours();
		return hour >= 18;
	});

	const showStreakWarning = $derived(
		layoutData.session && !layoutData.todayGameplayId && isLateInDay,
	);
</script>

<article>
	<header>
		<FlipText word="SCRMBLD" />
	</header>
	{#if showStreakWarning}
		<div class="streak-warning">
			<span class="fire">🔥</span>
			<span>Don't lose your streak! Play today's puzzle.</span>
		</div>
	{/if}
	<section>
		<p>Find the 7 letter word in 8 scrambled letters</p>
		<div class="actions">
			<a class="primary" href="/play">Play Now</a>
			<a href="/help">How to Play</a>
			{#if data.session?.user?.username}
				<a href="/user/{data.session.user.username}">My Account</a>
			{:else if data.session?.user?.id}
				<a href="/user/{data.session.user.id}">My Account</a>
			{:else if data.session}
				<a href="/account">My Account</a>
			{:else}
				<a href="/signin">Sign In</a>
				<!-- <a href="/newsletter/signup">Sign Up</a> -->
			{/if}
		</div>
	</section>
	<footer>
		<a href="/privacy-policy">Privacy</a>
		<span class="separator">·</span>
		<a href="/terms-of-service">Terms</a>
	</footer>
</article>

<style lang="scss">
	article {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
		max-width: 100vw;
		overflow: hidden;
		min-height: 100vh;
	}
	header {
		font-size: 1rem;
		@media (min-width: 350px) {
			font-size: 1.5rem;
		}
		@media (min-width: 400px) {
			font-size: 2rem;
		}
		@media (min-width: 600px) {
			font-size: 3rem;
		}
		@media (min-width: 768px) {
			font-size: 3.5rem;
		}
		@media (min-width: 1024px) {
			font-size: 3.5rem;
		}
		@media (min-width: 1200px) {
			font-size: 4.5rem;
		}
	}
	section {
		margin-bottom: 3rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		opacity: 1;
		transition: opacity 1s 1s;
		text-align: center;
		text-wrap: balance;
		max-width: 600px;
		@starting-style {
			opacity: 0;
		}
	}
	p {
		font-size: 1.5rem;
		@media (min-width: 600px) {
			font-size: 2rem;
		}
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
		min-width: min(80vw, 300px);
	}
	a {
		cursor: pointer;
		font-size: 1.25rem;
		text-decoration: none;
		border-radius: 4px;
		padding: 0.75rem 2rem;
		margin: 0;
		font-weight: 500;
		border: none;
		outline: none;
		background-color: rgba(255, 255, 255, 0.05);
		color: #dddddd;
		transition:
			transform 0.07s,
			opacity 0.2s;
		box-shadow: 0 4px 0 #333333;
		-webkit-tap-highlight-color: transparent;

		&:active {
			transform: translateY(4px);
			box-shadow: none;
		}
		&:not(.primary) {
			&:hover {
				background-color: rgba(255, 255, 255, 0.1);
				color: #ffffff;
			}
		}
		&.primary {
			background-color: #eeeeee;
			color: #333333;
			font-size: 2rem;
			box-shadow: 0 4px 0 #999999;
			&:hover {
				background-color: #ffffff;
				color: #000000;
			}
		}
	}
	footer {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		font-size: 0.8rem;
		color: #999999;

		a {
			color: #999999;
			text-decoration: none;
			background: none;
			box-shadow: none;
			padding: 0;
			font-size: inherit;
			font-weight: normal;

			&:hover {
				color: #888888;
				text-decoration: underline;
				background: none;
			}

			&:active {
				transform: none;
			}
		}

		.separator {
			margin: 0 0.2rem;
		}
	}

	.streak-warning {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background-color: rgba(255, 150, 50, 0.15);
		border: 1px solid #ff9632;
		color: #ffaa55;
		padding: 0.75rem 1.25rem;
		border-radius: 8px;
		font-size: 1rem;
		margin-bottom: 1rem;
		animation: pulse 2s infinite;

		.fire {
			font-size: 1.25rem;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}
</style>
