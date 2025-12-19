<script lang="ts">
	import FlipText from '$lib/FlipText.svelte';
	const { data } = $props();
</script>

<article>
	<header>
		<FlipText word="SCRMBLD" />
	</header>
	<section>
		<p>Find the 7 letter word in 8 scrambled letters</p>
		<div class="actions">
			<a class="primary" href="/play">Play Now</a>
			<a href="/help">How to Play</a>
			<a href="/signup">Sign Up</a>
		</div>
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
</style>
