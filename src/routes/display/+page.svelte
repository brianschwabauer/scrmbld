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

	// ── Raw texts from URL (multiple screens) ──────────
	const rawTexts = $derived.by(() => {
		const all = params.getAll('text');
		if (all.length === 0) return [DEFAULT_TEXT];
		return all.map((t) => t.replace(/\\n/g, '\n').slice(0, MAX_TEXT));
	});

	// ── Tick counter for dynamic refresh ───────────────
	let tick = $state(0);

	$effect(() => {
		if (!browser) return;
		const allText = rawTexts.join(' ');
		const hasSecond = /\{second\}/i.test(allText);
		const hasDynamic = /\{\w+\}/i.test(allText);
		if (!hasDynamic) return;
		const ms = hasSecond ? 1000 : 60_000;
		const id = setInterval(() => tick++, ms);
		return () => clearInterval(id);
	});

	const processedTexts = $derived.by(() => {
		tick;
		return rawTexts.map((t) => resolveTokens(t));
	});

	// ── Active screen cycling ──────────────────────────
	let activeScreen = $state(0);
	const interval = $derived(parseInt(params.get('interval') || '') || 15);

	$effect(() => {
		if (!browser || rawTexts.length <= 1) {
			activeScreen = 0;
			return;
		}
		activeScreen = 0;
		const id = setInterval(() => {
			activeScreen = (activeScreen + 1) % rawTexts.length;
		}, interval * 1000);
		return () => clearInterval(id);
	});

	// ── Word-wrap ──────────────────────────────────────
	function wrapText(text: string, cols: number): string[] {
		const lines: string[] = [];
		for (const para of text.split('\n')) {
			if (!para) {
				lines.push('');
				continue;
			}
			let pos = 0;
			while (pos < para.length) {
				if (pos + cols >= para.length) {
					lines.push(para.slice(pos));
					break;
				}
				const chunk = para.slice(pos, pos + cols + 1);
				const breakAt = chunk.lastIndexOf(' ', cols);
				if (breakAt > 0) {
					lines.push(para.slice(pos, pos + breakAt));
					pos += breakAt + 1;
				} else {
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

	// ── Dimensions (from biggest screen) ───────────────
	const autoCols = $derived.by(() => {
		let maxLen = 5;
		for (const text of processedTexts) {
			for (const para of text.split('\n')) {
				maxLen = Math.max(maxLen, para.length);
			}
		}
		return Math.min(maxLen, MAX_COLS);
	});

	const cols = $derived(
		Math.min(Math.max(parseInt(params.get('cols') || '') || autoCols, 1), MAX_COLS),
	);

	const autoRows = $derived.by(() => {
		let max = 1;
		for (const text of processedTexts) {
			max = Math.max(max, wrapText(text, cols).length);
		}
		return Math.min(max, MAX_ROWS);
	});

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
		const baseSet = new Set(base);
		const extra: string[] = [];
		for (const text of processedTexts) {
			for (const ch of text.toUpperCase()) {
				if (!baseSet.has(ch)) {
					baseSet.add(ch);
					extra.push(ch);
				}
			}
		}
		if (extra.length) {
			const space = base.pop()!;
			base.push(...extra, space);
		}
		return base;
	});

	// ── Display lines ──────────────────────────────────
	const displayLines = $derived.by(() => {
		const text = processedTexts[activeScreen] ?? processedTexts[0] ?? '';
		const wrapped = wrapText(text, cols);
		const lines = wrapped.slice(0, rows).map((l) => l.slice(0, cols));
		while (lines.length < rows) lines.push('');
		return lines;
	});

	// ── Mute ───────────────────────────────────────────
	let muted = $state(browser ? document.cookie.includes('scrmbld_muted=true') : false);

	// ── Settings panel ─────────────────────────────────
	let settingsOpen = $state(false);
	let sScreens = $state<string[]>([]);
	let sRows = $state('');
	let sCols = $state('');
	let sDuration = $state('');
	let sStagger = $state('');
	let sAlphabet = $state('default');
	let sInterval = $state('');

	function openSettings() {
		sScreens = [...rawTexts];
		sRows = params.get('rows') || '';
		sCols = params.get('cols') || '';
		sDuration = params.get('duration') || '';
		sStagger = params.get('stagger') || '';
		sAlphabet = params.get('alphabet') || 'default';
		sInterval = params.get('interval') || '';
		settingsOpen = true;
	}

	function applySettings() {
		const url = new URL(page.url);
		const p = url.searchParams;

		p.delete('text');
		const screens = sScreens.filter((s) => s.trim());
		if (screens.length === 0) screens.push(DEFAULT_TEXT);
		const isDefault = screens.length === 1 && screens[0] === DEFAULT_TEXT;
		if (!isDefault) {
			for (const s of screens) {
				p.append('text', s);
			}
		}

		function set(k: string, v: string, fallback = '') {
			if (v && v !== fallback) p.set(k, v);
			else p.delete(k);
		}
		set('rows', sRows);
		set('cols', sCols);
		set('duration', sDuration, '300');
		set('stagger', sStagger);
		set('alphabet', sAlphabet, 'default');
		if (screens.length > 1) {
			set('interval', sInterval, '15');
		} else {
			p.delete('interval');
		}
		goto(url.toString(), { replaceState: true });
		settingsOpen = false;
	}

	function addScreen() {
		sScreens = [...sScreens, ''];
	}

	function removeScreen(i: number) {
		sScreens = sScreens.filter((_, idx) => idx !== i);
	}

	function moveScreen(from: number, to: number) {
		if (to < 0 || to >= sScreens.length) return;
		const arr = [...sScreens];
		const [item] = arr.splice(from, 1);
		arr.splice(to, 0, item);
		sScreens = arr;
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
		<FlipGridCanvas lines={displayLines} {cols} {duration} {stagger} sound={!muted} {alphabet} initialDelay={500} />
	{/key}
</div>

{#if rawTexts.length > 1}
	<div class="screen-indicator">
		{#each rawTexts as _, i}
			<button
				class="dot"
				class:active={i === activeScreen}
				onclick={() => (activeScreen = i)}
				title="Screen {i + 1}"
			></button>
		{/each}
	</div>
{/if}

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
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
			><path
				fill="currentColor"
				d="m19.8 22.6l-3.025-3.025q-.625.4-1.325.688t-1.45.462v-2.05q.35-.125.688-.25t.637-.3L12 14.8V20l-5-5H3V9h3.2L1.4 4.2l1.4-1.4l18.4 18.4zm-.2-5.8l-1.45-1.45q.425-.775.638-1.625t.212-1.75q0-2.35-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975q0 1.325-.363 2.55T19.6 16.8m-3.35-3.35L14 11.2V7.95q1.175.55 1.838 1.65T16.5 12q0 .375-.062.738t-.188.712M12 9.2L9.4 6.6L12 4z"
			/></svg
		>
	{:else}
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
			><path
				fill="currentColor"
				d="M14 20.725v-2.05q2.25-.65 3.625-2.5t1.375-4.2t-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975t-1.95 5.613T14 20.725M3 15V9h4l5-5v16l-5-5zm11 1V7.95q1.175.55 1.838 1.65T16.5 12q0 1.275-.663 2.363T14 16"
			/></svg
		>
	{/if}
</button>

<!-- svelte-ignore a11y_consider_explicit_label -->
<button class="fab settings-fab" onpointerdown={openSettings} use:ripple title="Settings">
	<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
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

			<div class="screens-section">
				<div class="screens-header">
					<span class="screens-label">Screens</span>
					<button class="add-screen-btn" onclick={addScreen} use:ripple>+ Add</button>
				</div>
				{#each sScreens as _, i}
					<div class="screen-item">
						<div class="screen-item-header">
							<span class="screen-number">Screen {i + 1}</span>
							<div class="screen-actions">
								<button
									class="screen-action-btn"
									onclick={() => moveScreen(i, i - 1)}
									disabled={i === 0}
									title="Move up"
								>&#8593;</button>
								<button
									class="screen-action-btn"
									onclick={() => moveScreen(i, i + 1)}
									disabled={i === sScreens.length - 1}
									title="Move down"
								>&#8595;</button>
								<button
									class="screen-action-btn delete"
									onclick={() => removeScreen(i)}
									disabled={sScreens.length <= 1}
									title="Remove screen"
								>&times;</button>
							</div>
						</div>
						<textarea
							rows="3"
							bind:value={sScreens[i]}
							placeholder={i === 0 ? DEFAULT_TEXT : 'Screen text...'}
						></textarea>
					</div>
				{/each}
			</div>

			<p class="tip">
				Use \n for newlines. Dynamic tokens:
				<code>{'{date}'}</code> <code>{'{time}'}</code> <code>{'{month}'}</code>
				<code>{'{year}'}</code> <code>{'{day}'}</code> <code>{'{dayofweek}'}</code>
				<code>{'{hour}'}</code> <code>{'{hour24}'}</code> <code>{'{minute}'}</code>
				<code>{'{second}'}</code> <code>{'{ampm}'}</code>
			</p>

			{#if sScreens.length > 1}
				<label>
					<span>Screen interval (seconds)</span>
					<input
						type="number"
						value={sInterval}
						oninput={(e) => (sInterval = e.currentTarget.value)}
						placeholder="15"
						min="1"
						max="3600"
					/>
				</label>
			{/if}

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
		background-color: #222222;

		:global(.flip-text .letters .part) {
			will-change: auto !important;
		}
	}

	.screen-indicator {
		position: fixed;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 0.5rem;
		z-index: 10;

		.dot {
			width: 0.6rem;
			height: 0.6rem;
			border-radius: 50%;
			border: none;
			padding: 0;
			background: rgba(255, 255, 255, 0.25);
			cursor: pointer;
			transition: background 0.2s;

			&.active {
				background: #00b7a1;
			}

			&:hover:not(.active) {
				background: rgba(255, 255, 255, 0.45);
			}
		}
	}

	.fab {
		position: fixed;
		bottom: 0.75rem;
		background-color: transparent;
		color: rgba(255, 255, 255, 0.2);
		padding: 0;
		border-radius: 999px;
		width: 2.25rem;
		height: 2.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
		z-index: 10;
		-webkit-tap-highlight-color: transparent;
		transition: color 0.2s;
		&:hover {
			color: rgba(255, 255, 255, 0.5);
		}
	}

	.mute-fab {
		left: 0.75rem;
	}

	.settings-fab {
		right: 0.75rem;
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

		.screens-section {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		.screens-header {
			display: flex;
			justify-content: space-between;
			align-items: center;

			.screens-label {
				font-size: 0.8rem;
				color: #aaa;
			}

			.add-screen-btn {
				background: none;
				border: 1px solid #555;
				color: #aaa;
				padding: 0.2rem 0.5rem;
				border-radius: 6px;
				font-family: inherit;
				font-size: 0.75rem;
				cursor: pointer;
				&:hover {
					color: #fff;
					border-color: #00b7a1;
				}
			}
		}

		.screen-item {
			background: #2a2a2a;
			border-radius: 8px;
			padding: 0.5rem;
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		.screen-item-header {
			display: flex;
			justify-content: space-between;
			align-items: center;

			.screen-number {
				font-size: 0.75rem;
				color: #888;
			}

			.screen-actions {
				display: flex;
				gap: 0.15rem;
			}

			.screen-action-btn {
				background: none;
				border: none;
				color: #888;
				cursor: pointer;
				padding: 0.1rem 0.35rem;
				border-radius: 4px;
				font-size: 0.85rem;
				line-height: 1;
				font-family: inherit;

				&:hover:not(:disabled) {
					color: #fff;
					background: rgba(255, 255, 255, 0.1);
				}

				&:disabled {
					opacity: 0.3;
					cursor: default;
				}

				&.delete:hover:not(:disabled) {
					color: #ff6b6b;
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
