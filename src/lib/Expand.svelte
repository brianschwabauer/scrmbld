<script lang="ts">
	import { type Snippet } from 'svelte';

	let {
		show = $bindable(false),
		style = '',
		children = undefined as undefined | Snippet,
	} = $props();
</script>

{#if children}
	<div class:show inert={!show} {style}>
		{@render children()}
	</div>
{/if}

<style lang="scss">
	div {
		display: grid;
		grid-template-rows: min-content 0fr;
		transition:
			grid-template-rows 300ms ease,
			opacity 200ms;
		opacity: 0;
		&::before {
			content: '';
		}
		:global(> *) {
			visibility: hidden;
			overflow: hidden;
			transition-behavior: allow-discrete;
			transition: visibility 0ms 200ms;
		}
		&.show {
			opacity: 1;
			grid-template-rows: min-content 1fr;
			:global(> *) {
				visibility: visible;
				transition: visibility 0ms;
			}
		}
	}
</style>
