<script lang="ts">
	import { assets } from '$app/paths';

	let { data } = $props();
	const stats = $derived(data.stats);
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<article>
	<img src="{assets}/scrmbld-logo-web.png" alt="Scrmbld Logo" />
	<ul>
		{#each stats as stat}
			<li>
				<h2>{stat.word}</h2>
				<h3>
					{new Date(stat.day).toLocaleDateString(undefined, {
						timeZone: 'UTC',
						dateStyle: 'medium'
					})}
				</h3>
				<div class="stats">
					<p>{Intl.NumberFormat().format(stat.numAttempts)} attempts</p>
					<p>{Intl.NumberFormat().format(stat.numCorrect)} correct</p>
					<p>
						{#if stat.average >= 1000 * 100}
							{Intl.NumberFormat(undefined, {
								maximumFractionDigits: 2,
								unit: 'minute',
								unitDisplay: 'short'
							}).format(stat.average / 1000 / 60)}m average
						{:else}
							{Intl.NumberFormat(undefined, {
								maximumFractionDigits: 1,
								unit: 'second',
								unitDisplay: 'short'
							}).format(stat.average / 1000)}s average
						{/if}
					</p>
				</div>
			</li>
		{/each}
	</ul>
</article>

<style lang="scss">
	article {
		max-width: 600px;
		text-align: left;
		margin: 0 auto;
	}
	img {
		display: block;
		margin: 1rem auto 2rem;
		max-width: min(100%, 400px);
	}
	h1 {
		font-size: 2rem;
	}
	h2 {
		margin: 0;
		font-size: 2rem;
		text-align: center;
	}
	h3 {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.8;
		text-align: center;
	}
	ul {
		display: flex;
		flex-direction: column;
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 1rem;
	}
	li {
		margin: 0;
		list-style: none;
		background-color: #555555;
		border-radius: 10px;
		padding: 1rem;
	}
	.stats {
		display: flex;
		margin-top: 1rem;
		p {
			flex: 1;
			text-align: center;
		}
	}
</style>
