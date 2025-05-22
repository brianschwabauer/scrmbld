<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	const { showModal, children }: { showModal: boolean; children: Snippet } = $props();
</script>

{#if showModal}
	<div class="modal-backdrop" transition:fade={{ duration: 150 }}>
		<div class="modal-content" transition:fade={{ duration: 150, delay: 50 }}>
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal-content {
		background: #2c2c2c;
		color: #ffffff;
		padding: 2em;
		border-radius: 8px;
		box-shadow: 0 0 15px rgba(0,0,0,0.5);
		min-width: 300px;
		max-width: 90%; /* More responsive */
        max-height: 90vh;
        overflow-y: auto;
		text-align: center;
	}
</style>
