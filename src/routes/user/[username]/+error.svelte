<script lang="ts">
	import { page } from '$app/state';
	import BottomNav from '$lib/BottomNav.svelte';

	const layoutData = $derived(page.data);
	const status = $derived(page.status);
	const message = $derived(page.error?.message || 'Unknown error');

	const heading = $derived.by(() => {
		if (status === 404) return 'Player not found';
		if (status === 403) return 'Private profile';
		return 'Something went wrong';
	});

	const description = $derived.by(() => {
		if (status === 404) return "This user doesn't exist or hasn't set up their profile yet.";
		if (status === 403) return message;
		return message;
	});
</script>

<div class="container" class:has-nav={layoutData.session}>
	<div class="error-content">
		<span class="status-code">{status}</span>
		<h1>{heading}</h1>
		<p>{description}</p>
		<div class="actions">
			<a href="/friends">Friends</a>
			<a href="/play" class="primary" data-sveltekit-reload>Play</a>
		</div>
	</div>
</div>

{#if layoutData.session}
	<BottomNav
		userId={layoutData.session?.user?.id}
		username={layoutData.session?.user?.username}
		todayGameplayId={layoutData.todayGameplayId}
	/>
{/if}

<style lang="scss">
	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;

		&.has-nav {
			padding-bottom: calc(5rem + env(safe-area-inset-bottom));

			@media (min-width: 768px) {
				padding: 2rem 1rem 4rem calc(1rem + 100px);
				max-width: 650px;
			}
		}
	}

	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-top: 20vh;
	}

	.status-code {
		font-size: 5rem;
		font-weight: bold;
		color: #555555;
		line-height: 1;
	}

	h1 {
		margin: 0.75rem 0 0.5rem;
		font-size: 1.5rem;
	}

	p {
		margin: 0 auto 2rem;
		max-width: 400px;
		text-wrap: pretty;
		color: #aaaaaa;
	}

	.actions {
		display: flex;
		gap: 1rem;
	}

	a {
		cursor: pointer;
		font-size: 1rem;
		text-decoration: none;
		border-radius: 4px;
		padding: 0.75rem 1.5rem;
		font-weight: 600;
		border: 1px solid #555555;
		color: #cccccc;
		background-color: transparent;
		box-shadow: 0 3px 0 #333333;
		transition:
			transform 0.1s,
			opacity 0.15s;
		-webkit-tap-highlight-color: transparent;

		&:hover {
			opacity: 0.9;
		}

		&:active {
			transform: translateY(3px);
			box-shadow: none;
		}

		&.primary {
			background-color: #eeeeee;
			color: #333333;
			border: none;
			box-shadow: 0 3px 0 #999999;

			&:hover {
				opacity: 0.9;
			}
		}
	}
</style>
