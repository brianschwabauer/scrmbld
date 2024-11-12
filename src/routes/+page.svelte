<script lang="ts">
	import FlipText from '$lib/FlipText.svelte';
	const { data } = $props();
</script>

<svelte:head>
	<title>SCRMBLD</title>
</svelte:head>

<article>
	<header>
		<FlipText word="SCRMBLD" />
	</header>
	<section>
		<p>Find the 7 letter word in 8 scrambled letters</p>
		<a href="/play">Play</a>
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
