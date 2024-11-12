<script lang="ts">
	import { ripple } from './ripple';

	let { onclick = (() => {}) as (key: string) => void } = $props();
</script>

<div class="keyboard">
	<div class="row">
		<button use:ripple class="key" onclick={() => onclick('Q')} aria-label="Add Q">Q</button>
		<button use:ripple class="key" onclick={() => onclick('W')} aria-label="Add W">W</button>
		<button use:ripple class="key" onclick={() => onclick('E')} aria-label="Add E">E</button>
		<button use:ripple class="key" onclick={() => onclick('R')} aria-label="Add R">R</button>
		<button use:ripple class="key" onclick={() => onclick('T')} aria-label="Add T">T</button>
		<button use:ripple class="key" onclick={() => onclick('Y')} aria-label="Add Y">Y</button>
		<button use:ripple class="key" onclick={() => onclick('U')} aria-label="Add U">U</button>
		<button use:ripple class="key" onclick={() => onclick('I')} aria-label="Add I">I</button>
		<button use:ripple class="key" onclick={() => onclick('O')} aria-label="Add O">O</button>
		<button use:ripple class="key" onclick={() => onclick('p')} aria-label="Add P">P</button>
	</div>
	<div class="row">
		<button use:ripple class="key" onclick={() => onclick('A')} aria-label="Add A">A</button>
		<button use:ripple class="key" onclick={() => onclick('S')} aria-label="Add S">S</button>
		<button use:ripple class="key" onclick={() => onclick('D')} aria-label="Add D">D</button>
		<button use:ripple class="key" onclick={() => onclick('F')} aria-label="Add F">F</button>
		<button use:ripple class="key" onclick={() => onclick('G')} aria-label="Add G">G</button>
		<button use:ripple class="key" onclick={() => onclick('H')} aria-label="Add H">H</button>
		<button use:ripple class="key" onclick={() => onclick('J')} aria-label="Add J">J</button>
		<button use:ripple class="key" onclick={() => onclick('K')} aria-label="Add K">K</button>
		<button use:ripple class="key" onclick={() => onclick('L')} aria-label="Add L">L</button>
	</div>
	<div class="row">
		<button
			use:ripple
			class="key enter"
			onclick={() => onclick('Clear')}
			aria-label="Clear All Letters">CLEAR</button
		>
		<button use:ripple class="key" onclick={() => onclick('Z')} aria-label="Add Z">Z</button>
		<button use:ripple class="key" onclick={() => onclick('X')} aria-label="Add X">X</button>
		<button use:ripple class="key" onclick={() => onclick('C')} aria-label="Add C">C</button>
		<button use:ripple class="key" onclick={() => onclick('V')} aria-label="Add V">V</button>
		<button use:ripple class="key" onclick={() => onclick('B')} aria-label="Add B">B</button>
		<button use:ripple class="key" onclick={() => onclick('N')} aria-label="Add N">N</button>
		<button use:ripple class="key" onclick={() => onclick('M')} aria-label="Add M">M</button>
		<button
			use:ripple
			class="key backspace"
			onclick={() => onclick('Backspace')}
			aria-label="Backspace"
		>
			<svg
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
				height="20"
				viewBox="0 0 24 24"
				width="20"
				><path
					fill="currentColor"
					d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7.07L2.4 12l4.66-7H22v14zm-11.59-2L14 13.41 17.59 17 19 15.59 15.41 12 19 8.41 17.59 7 14 10.59 10.41 7 9 8.41 12.59 12 9 15.59z"
				></path></svg
			>
		</button>
	</div>
</div>

<style lang="scss">
	.keyboard {
		--key-width: 32px;
		--key-height: 45px;
		--key-gap: 8px;
		display: flex;
		flex-direction: column;
		gap: var(--key-gap);
		max-width: min(calc(100vw - 1rem), 600px);
		font-size: 1.1rem;
		@media (min-width: 600px) {
			--key-width: 45px;
			--key-height: 60px;
			font-size: 1.5rem;
		}
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		gap: var(--key-gap);
	}
	button.key {
		-webkit-tap-highlight-color: transparent;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--key-width);
		height: var(--key-height);
		color: #dddddd;
		border-radius: 0.25rem;
		background-color: rgba(255, 255, 255, 0.05);
		border: none;
		outline: none;
		cursor: pointer;
		font-size: 1em;
		transition:
			color 100ms ease,
			background-color 100ms ease;
		font-family: 'Roboto Mono', monospace;
		font-optical-sizing: auto;
		font-weight: 400;
		font-style: normal;
		&:hover {
			background-color: rgba(255, 255, 255, 0.1);
			color: #ffffff;
		}
		&.enter,
		&.backspace {
			width: calc(var(--key-width) * 1.5);
			font-size: 0.6em;
		}
		&:focus-visible {
			outline: solid 1px #ffffff;
			outline-offset: 1px;
		}
	}
</style>
