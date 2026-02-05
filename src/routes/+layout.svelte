<script lang="ts">
	import { browser } from '$app/environment';
	import { assets } from '$app/paths';
	import { page } from '$app/state';
	import { initializeAudio } from '$lib/audio';

	const { children } = $props();

	// Auto-save timezone for signed-in users without one
	$effect(() => {
		if (browser && page.data.session?.user && !page.data.session.user.timezone) {
			const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (browserTimezone) {
				// Fire and forget - don't block on this
				fetch('/api/account/timezone', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ timezone: browserTimezone }),
				}).catch(() => {
					// Ignore errors - this is a best-effort operation
				});
			}
		}
	});
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
