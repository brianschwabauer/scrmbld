<script lang="ts">
	import { assets } from '$app/paths';
	import { initializeAudio } from '$lib/audio';

	const { children } = $props();
</script>

<svelte:head>
	<title>SCRMBLD | A daily word puzzle</title>
	<meta name="description" content="Find the 7-letter word in 8 scrambled letters" />
	<meta property="og:title" content="SCRMBLD | A daily word puzzle" />
	<meta property="og:image" content="{assets}/scrmbld-card.jpg" />
	<meta property="og:url" content="https://scrmbld.app" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta property="og:description" content="Find the 7-letter word in 8 scrambled letters" />
	<meta property="og:site_name" content="SCRMBLD" />
</svelte:head>

<svelte:window
	onpointerdown={() => {
		initializeAudio();
	}}
/>

{@render children()}

<style lang="scss">
	@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap');
	:global(body) {
		margin: 0;
		background-color: #444444;
		color: #eeeeee;
		font-family: 'Roboto Mono', monospace;
		font-optical-sizing: auto;
		font-weight: 400;
		font-style: normal;
	}
</style>
