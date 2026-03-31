<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import FlipGridCanvas from '$lib/FlipGridCanvas.svelte';
	import { ripple } from '$lib/ripple';
	import { fade } from 'svelte/transition';

	const DEFAULT_TEXT = 'HELLO WORLD';
	const MAX_TEXT = 1000;
	const MAX_COLS = 80;
	const MAX_ROWS = 40;

	const params = $derived(page.url.searchParams);

	// ── Dynamic text tokens ────────────────────────────
	function pad(n: number) {
		return String(n).padStart(2, '0');
	}

	const TOKENS: Record<string, () => string> = {
		date: () => {
			return new Date().toLocaleDateString(undefined, {
				month: '2-digit',
				day: '2-digit',
				year: '2-digit',
			});
		},
		time: () => {
			return new Date().toLocaleTimeString(undefined, {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
			});
		},
		month: () => new Date().toLocaleString('en-US', { month: 'long' }).toUpperCase(),
		year: () => String(new Date().getFullYear()),
		day: () => String(new Date().getDate()),
		dayofweek: () => new Date().toLocaleString('en-US', { weekday: 'long' }).toUpperCase(),
		hour: () => String(new Date().getHours() % 12 || 12),
		hour24: () => pad(new Date().getHours()),
		minute: () => pad(new Date().getMinutes()),
		second: () => pad(new Date().getSeconds()),
		pm: () => (new Date().getHours() >= 12 ? 'PM' : 'AM'),
		ampm: () => (new Date().getHours() >= 12 ? 'PM' : 'AM'),
	};

	function resolveTokens(text: string): string {
		return text.replace(/\{(\w+)\}/gi, (_, key) => {
			const fn = TOKENS[key.toLowerCase()];
			return fn ? fn() : `{${key}}`;
		});
	}

	// ── Raw text from URL ──────────────────────────────
	const rawText = $derived(
		(params.get('text') || DEFAULT_TEXT).replace(/\\n/g, '\n').slice(0, MAX_TEXT),
	);

	// ── Tick counter for dynamic refresh ───────────────
	let tick = $state(0);

	$effect(() => {
		if (!browser) return;
		const hasSecond = /\{second\}/i.test(rawText);
		const hasDynamic = /\{\w+\}/i.test(rawText);
		if (!hasDynamic) return;
		const ms = hasSecond ? 1000 : 60_000;
		const id = setInterval(() => tick++, ms);
		return () => clearInterval(id);
	});

	const processedText = $derived.by(() => {
		tick;
		return resolveTokens(rawText);
	});

	// ── Word-wrap ──────────────────────────────────────
	function wrapText(text: string, cols: number): string[] {
		const lines: string[] = [];
		for (const para of text.split('\n')) {
			if (!para) {
				lines.push('');
				continue;
			}
			// Walk through the paragraph preserving all spaces.
			// Break at the last space that fits when a line exceeds cols.
			let pos = 0;
			while (pos < para.length) {
				if (pos + cols >= para.length) {
					// Rest of paragraph fits on one line
					lines.push(para.slice(pos));
					break;
				}
				// Find the last space within the cols limit to break at
				const chunk = para.slice(pos, pos + cols + 1);
				const breakAt = chunk.lastIndexOf(' ', cols);
				if (breakAt > 0) {
					lines.push(para.slice(pos, pos + breakAt));
					pos += breakAt + 1; // skip past the breaking space
				} else {
					// No space found — hard break at cols
					lines.push(para.slice(pos, pos + cols));
					pos += cols;
				}
			}
			if (
				pos >= para.length &&
				para.length > 0 &&
				lines[lines.length - 1] !== para.slice(pos - (para.length - pos))
			) {
				// Handled in the loop above
			}
		}
		return lines;
	}

	// ── Dimensions ─────────────────────────────────────
	const autoCols = $derived.by(() => {
		const paras = processedText.split('\n');
		return Math.min(Math.max(...paras.map((p) => p.length), 5), MAX_COLS);
	});

	const cols = $derived(
		Math.min(Math.max(parseInt(params.get('cols') || '') || autoCols, 1), MAX_COLS),
	);

	const autoRows = $derived(Math.min(Math.max(wrapText(processedText, cols).length, 1), MAX_ROWS));

	const rows = $derived(
		Math.min(Math.max(parseInt(params.get('rows') || '') || autoRows, 1), MAX_ROWS),
	);

	const duration = $derived(parseInt(params.get('duration') || '') || 300);
	const staggerParam = $derived(params.get('stagger'));
	const stagger = $derived(staggerParam ? parseInt(staggerParam) || undefined : undefined);

	// ── Alphabet ───────────────────────────────────────
	const alphabetKey = $derived(params.get('alphabet') || 'default');
	const alphabet = $derived.by((): string[] | undefined => {
		let base: string[];
		switch (alphabetKey) {
			case 'letters':
				base = ['', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), ' '];
				break;
			case 'numbers':
				base = ['', ...Array.from({ length: 10 }, (_, i) => String.fromCharCode(48 + i)), ' '];
				break;
			case 'minimal':
				base = ['', ' '];
				break;
			default:
				base = [
					'',
					'@',
					'#',
					'+',
					'=',
					'?',
					':',
					...Array.from({ length: 10 }, (_, i) => String.fromCharCode(48 + i)),
					...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
					' ',
				];
		}
		// Merge in any characters from the text that aren't already in the base alphabet
		const baseSet = new Set(base);
		const extra: string[] = [];
		for (const ch of processedText.toUpperCase()) {
			if (!baseSet.has(ch)) {
				baseSet.add(ch);
				extra.push(ch);
			}
		}
		// Insert extra characters before the trailing space so the flap cycles through them
		if (extra.length) {
			const space = base.pop()!; // remove trailing ' '
			base.push(...extra, space);
		}
		return base;
	});

	// ── Display lines ──────────────────────────────────
	const displayLines = $derived.by(() => {
		const wrapped = wrapText(processedText, cols);
		const lines = wrapped.slice(0, rows).map((l) => l.slice(0, cols));
		while (lines.length < rows) lines.push('');
		return lines;
	});

	// ── Mute ───────────────────────────────────────────
	let muted = $state(browser ? document.cookie.includes('scrmbld_muted=true') : false);

	// ── Settings panel ─────────────────────────────────
	let settingsOpen = $state(false);
	let sText = $state('');
	let sRows = $state('');
	let sCols = $state('');
	let sDuration = $state('');
	let sStagger = $state('');
	let sAlphabet = $state('default');

	function openSettings() {
		sText = rawText;
		sRows = params.get('rows') || '';
		sCols = params.get('cols') || '';
		sDuration = params.get('duration') || '';
		sStagger = params.get('stagger') || '';
		sAlphabet = params.get('alphabet') || 'default';
		settingsOpen = true;
	}

	function applySettings() {
		const url = new URL(page.url);
		const p = url.searchParams;
		function set(k: string, v: string, fallback = '') {
			if (v && v !== fallback) p.set(k, v);
			else p.delete(k);
		}
		set('text', sText, DEFAULT_TEXT);
		set('rows', sRows);
		set('cols', sCols);
		set('duration', sDuration, '300');
		set('stagger', sStagger);
		set('alphabet', sAlphabet, 'default');
		goto(url.toString(), { replaceState: true });
		settingsOpen = false;
	}
</script>

<svelte:head>
	<title>Display | SCRMBLD</title>
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && settingsOpen) settingsOpen = false;
	}}
/>

<div class="display" style:--cols={cols} style:--rows={rows}>
	{#key `${alphabetKey}|${duration}|${stagger ?? ''}`}
		<FlipGridCanvas lines={displayLines} {cols} {duration} {stagger} sound={!muted} {alphabet} />
	{/key}
</div>

<button
	class="fab mute-fab"
	onpointerdown={() => {
		muted = !muted;
		document.cookie = `scrmbld_muted=${muted}; path=/`;
	}}
	use:ripple
	title={muted ? 'Unmute' : 'Mute'}
>
	{#if muted}
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
			><path
				fill="currentColor"
				d="m19.8 22.6l-3.025-3.025q-.625.4-1.325.688t-1.45.462v-2.05q.35-.125.688-.25t.637-.3L12 14.8V20l-5-5H3V9h3.2L1.4 4.2l1.4-1.4l18.4 18.4zm-.2-5.8l-1.45-1.45q.425-.775.638-1.625t.212-1.75q0-2.35-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975q0 1.325-.363 2.55T19.6 16.8m-3.35-3.35L14 11.2V7.95q1.175.55 1.838 1.65T16.5 12q0 .375-.062.738t-.188.712M12 9.2L9.4 6.6L12 4z"
			/></svg
		>
	{:else}
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
			><path
				fill="currentColor"
				d="M14 20.725v-2.05q2.25-.65 3.625-2.5t1.375-4.2t-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975t-1.95 5.613T14 20.725M3 15V9h4l5-5v16l-5-5zm11 1V7.95q1.175.55 1.838 1.65T16.5 12q0 1.275-.663 2.363T14 16"
			/></svg
		>
	{/if}
</button>

<!-- svelte-ignore a11y_consider_explicit_label -->
<button class="fab settings-fab" onpointerdown={openSettings} use:ripple title="Settings">
	<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
		><path
			fill="currentColor"
			d="m9.25 22l-.4-3.2q-.325-.125-.612-.3t-.563-.375L4.7 19.375l-2.75-4.75l2.575-1.95Q4.5 12.5 4.5 12.338v-.675q0-.163.025-.338L1.95 9.375l2.75-4.75l2.975 1.25q.275-.2.575-.375t.6-.3l.4-3.2h5.5l.4 3.2q.325.125.613.3t.562.375l2.975-1.25l2.75 4.75l-2.575 1.95q.025.175.025.338v.674q0 .163-.05.338l2.575 1.95l-2.75 4.75l-2.95-1.25q-.275.2-.575.375t-.6.3l-.4 3.2zM12 15.5q1.45 0 2.475-1.025T15.5 12t-1.025-2.475T12 8.5T9.525 9.525T8.5 12t1.025 2.475T12 15.5"
		/></svg
	>
</button>

{#if settingsOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="settings-backdrop"
		onclick={() => (settingsOpen = false)}
		transition:fade={{ duration: 150 }}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="settings-panel" onclick={(e) => e.stopPropagation()}>
			<div class="settings-header">
				<h3>Display Settings</h3>
				<button class="close-btn" onclick={() => (settingsOpen = false)}>&times;</button>
			</div>

			<label>
				<span>Text</span>
				<textarea rows="3" bind:value={sText} placeholder={DEFAULT_TEXT}></textarea>
			</label>

			<p class="tip">
				Use \n for newlines. Dynamic tokens:
				<code>{'{date}'}</code> <code>{'{time}'}</code> <code>{'{month}'}</code>
				<code>{'{year}'}</code> <code>{'{day}'}</code> <code>{'{dayofweek}'}</code>
				<code>{'{hour}'}</code> <code>{'{hour24}'}</code> <code>{'{minute}'}</code>
				<code>{'{second}'}</code> <code>{'{ampm}'}</code>
			</p>

			<div class="field-row">
				<label>
					<span>Columns</span>
					<input
						type="number"
						value={sCols}
						oninput={(e) => (sCols = e.currentTarget.value)}
						placeholder="auto"
						min="1"
						max={MAX_COLS}
					/>
				</label>
				<label>
					<span>Rows</span>
					<input
						type="number"
						value={sRows}
						oninput={(e) => (sRows = e.currentTarget.value)}
						placeholder="auto"
						min="1"
						max={MAX_ROWS}
					/>
				</label>
			</div>

			<div class="field-row">
				<label>
					<span>Flip duration (ms)</span>
					<input
						type="number"
						value={sDuration}
						oninput={(e) => (sDuration = e.currentTarget.value)}
						placeholder="300"
						min="50"
						max="2000"
					/>
				</label>
				<label>
					<span>Stagger (ms)</span>
					<input
						type="number"
						value={sStagger}
						oninput={(e) => (sStagger = e.currentTarget.value)}
						placeholder="auto"
						min="0"
						max="1000"
					/>
				</label>
			</div>

			<label>
				<span>Alphabet</span>
				<select bind:value={sAlphabet}>
					<option value="default">Default (symbols + numbers + letters)</option>
					<option value="letters">Letters only (A-Z)</option>
					<option value="numbers">Numbers only (0-9)</option>
					<option value="minimal">Minimal (no cycling)</option>
				</select>
			</label>

			<button class="apply-btn" onclick={applySettings} use:ripple>Apply</button>
		</div>
	</div>
{/if}

<style lang="scss">
	.display {
		// Font-size scaled to fill the viewport based on grid dimensions.
		// Each letter cell is 1.5em wide × 2em tall (FlipText .part: font-size 2em, width 0.75em, height 1em).
		// Letter gap: ~0.1em, board padding: ~0.24em per row, row gap: 0.15em.
		--tw: calc(1.6 * var(--cols) + 0.14);
		--th: calc(2.39 * var(--rows) - 0.15);
		font-size: min(calc((100vw - 2rem) / var(--tw)), calc((100dvh - 2rem) / var(--th)), 150px);

		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		min-height: 100dvh;
		gap: 0.15em;
		padding: 1rem;
		box-sizing: border-box;
		contain: layout style;

		// Remove compositor layer promotion from individual flap elements on this page.
		// FlipText creates .part elements per letter (2 × maxFlaps), each with will-change which creates
		// a separate compositor layer. During resize, the browser must resize every layer.
		// Removing will-change lets the browser promote on-demand during animations instead.
		:global(.flip-text .letters .part) {
			will-change: auto !important;
		}
	}

	.fab {
		position: fixed;
		bottom: 1rem;
		background-color: rgba(255, 255, 255, 0.05);
		color: #dddddd;
		padding: 0;
		border-radius: 999px;
		width: 3.5rem;
		height: 3.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(10px);
		border: none;
		cursor: pointer;
		z-index: 10;
		-webkit-tap-highlight-color: transparent;
		&:hover {
			background-color: rgba(255, 255, 255, 0.1);
		}
	}

	.mute-fab {
		left: 1rem;
	}

	.settings-fab {
		right: 1rem;
	}

	.settings-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.settings-panel {
		background: #333;
		border-radius: 16px;
		padding: 1.5rem;
		max-width: 480px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		font-family: 'Roboto Mono', monospace;
		color: #eee;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		.settings-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			h3 {
				margin: 0;
				font-size: 1.1rem;
			}
			.close-btn {
				background: none;
				border: none;
				color: #999;
				font-size: 1.5rem;
				cursor: pointer;
				padding: 0.25rem 0.5rem;
				line-height: 1;
				border-radius: 8px;
				&:hover {
					color: #fff;
					background: rgba(255, 255, 255, 0.1);
				}
			}
		}

		label {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			span {
				font-size: 0.8rem;
				color: #aaa;
			}
		}

		input,
		textarea,
		select {
			background: #222;
			color: #eee;
			border: 1px solid #555;
			border-radius: 8px;
			padding: 0.5rem 0.6rem;
			font-family: inherit;
			font-size: 0.85rem;
			outline: none;
			&:focus {
				border-color: #00b7a1;
			}
		}

		textarea {
			resize: vertical;
		}

		.field-row {
			display: flex;
			gap: 0.75rem;
			label {
				flex: 1;
			}
		}

		.tip {
			font-size: 0.72rem;
			color: #888;
			line-height: 1.5;
			margin: 0;
			code {
				background: #222;
				padding: 0.1em 0.3em;
				border-radius: 3px;
				font-size: 0.9em;
			}
		}

		.apply-btn {
			background: #00b7a1;
			color: #fff;
			border: none;
			padding: 0.65rem;
			border-radius: 8px;
			font-size: 0.9rem;
			font-family: inherit;
			cursor: pointer;
			font-weight: 600;
			margin-top: 0.25rem;
			&:hover {
				background: #00a08d;
			}
		}
	}
</style>
