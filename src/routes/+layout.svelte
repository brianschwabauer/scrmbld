<script lang="ts">
	const { children } = $props();
</script>

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
