<script lang="ts">
	import { page } from '$app/state';
	import FlipText from '$lib/FlipText.svelte';
</script>

<article>
	<header>
		<FlipText word="SCRMBLD" />
		<div class="message">
			<h1>Uh oh! Something went wrong.</h1>
			<p>{page.error?.message || 'Unknown error'}</p>
		</div>
	</header>
	<section>
		<a href="/play" data-sveltekit-reload>Play</a>
	</section>
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
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		h1 {
			margin: 2rem 0 0.5rem;
		}
		p {
			margin: 0 0 2rem;
			max-width: 400px;
			text-align: center;
			text-wrap: pretty;
		}
		:global(.flip-text) {
			font-size: 1.75rem;
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
	a {
		cursor: pointer;
		font-size: 2rem;
		text-decoration: none;
		border-radius: 999px;
		background-color: #eeeeee;
		color: #333333;
		padding: 0.5rem 2rem;
		font-weight: 500;
		border: none;
		outline: none;
		box-shadow: none;
		&:hover {
			background-color: #ffffff;
			color: #000000;
		}
	}
</style>
