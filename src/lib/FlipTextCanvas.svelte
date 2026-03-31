<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { playSplitFlapSound, playSuccessSound, playFailureSound } from './audio';

	// ── Props (matching FlipText API) ──────────────────────────────────────────
	const {
		word = '',
		minLength = 7,
		duration = 300,
		stagger = undefined as number | undefined,
		sound = false,
		volume = 1,
		selectionStart = -1 as number,
		selectionEnd = -1 as number,
		success = false,
		error = false,
		usedLetters = undefined as Set<number> | undefined,
		class: className = '',
		alphabet = [
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
		],
		onclick = undefined as ((index: number) => void) | undefined,
	} = $props();

	const STRIPS = 12;
	const PERSP = 80;
	const SPRING_DUR = 1000;
	const MAX_OVERLAPPING = 8;
	const DUR = $derived(duration);
	const STAG = $derived(stagger ?? Math.floor(duration * 0.2));

	// ── Spring easing ──────────────────────────────────────────────────────────
	const SP: [number, number][] = [
		[0, 0],
		[0.0105, 0.009],
		[0.021, 0.035],
		[0.044, 0.141],
		[0.067, 0.281],
		[0.129, 0.723],
		[0.167, 0.938],
		[0.186, 1.017],
		[0.205, 1.077],
		[0.224, 1.121],
		[0.243, 1.149],
		[0.257, 1.159],
		[0.271, 1.163],
		[0.285, 1.161],
		[0.299, 1.154],
		[0.328, 1.129],
		[0.396, 1.051],
		[0.431, 1.017],
		[0.471, 0.991],
		[0.51, 0.977],
		[0.538, 0.974],
		[0.571, 0.975],
		[0.698, 0.997],
		[0.769, 1.003],
		[0.838, 1.004],
		[1, 1],
	];
	function spring(t: number): number {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		let lo = 0,
			hi = SP.length - 1;
		while (lo < hi - 1) {
			const mid = (lo + hi) >> 1;
			if (SP[mid][0] <= t) lo = mid;
			else hi = mid;
		}
		const [t0, v0] = SP[lo];
		const [t1, v1] = SP[hi];
		return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
	}

	// ── Letters ────────────────────────────────────────────────────────────────
	const letters = $derived.by(() => {
		const split = word.toUpperCase().split('');
		return split.concat(Array.from({ length: Math.max(0, minLength - split.length) }, () => ''));
	});
	const numCells = $derived(Math.max(minLength, letters.length));

	// ── Canvas refs & sizing ───────────────────────────────────────────────────
	let wrapper = $state<HTMLDivElement>();
	let canvasEl = $state<HTMLCanvasElement>();
	let ctx: CanvasRenderingContext2D | null = null;
	let dpr = 1;
	let em = 16;
	let cellW = 0,
		cellH = 0,
		cellGap = 0,
		flapGap = 0;
	let boardPad = 0,
		boardR = 0,
		cellR = 0;
	let topClipY = 0,
		bottomClipY = 0;
	let totalW = 0,
		totalH = 0;
	let textYOffset = 0; // vertical offset to visually center uppercase glyphs
	let fontStr = '';

	function recomputeSizes() {
		if (!wrapper || !canvasEl) return;
		em = parseFloat(getComputedStyle(wrapper).fontSize) || 16;
		dpr = window.devicePixelRatio || 1;
		const pfs = 2 * em;
		cellW = 0.75 * pfs;
		cellH = 1.0 * pfs;
		cellGap = Math.max(2, 0.1 * em);
		flapGap = Math.max(2, 0.045 * em);
		boardPad = 0.12 * em;
		boardR = 0.08 * em;
		cellR = 0.05 * em;
		topClipY = cellH / 2 - flapGap / 2;
		bottomClipY = cellH / 2 + flapGap / 2;
		fontStr = `500 ${pfs}px "Roboto Mono", monospace`;
		// Measure actual glyph bounds to compute visual center offset.
		// Canvas 'middle' baseline uses the em-square center, which sits too high
		// for uppercase-heavy text because of descender space.
		if (ctx || canvasEl) {
			const mc = (ctx || canvasEl!.getContext('2d'))!;
			mc.font = fontStr;
			mc.textBaseline = 'middle';
			const m = mc.measureText('H');
			// actualBoundingBoxAscent/Descent are relative to the baseline position.
			// With 'middle', baseline is at the em-square center. Positive ascent = above.
			const a = m.actualBoundingBoxAscent ?? 0;
			const d = m.actualBoundingBoxDescent ?? 0;
			// The glyph's visual center is offset from the baseline by (d - a) / 2
			textYOffset = (a - d) / 2;
		}
		const n = numCells;
		totalW = n * cellW + Math.max(0, n - 1) * cellGap + 2 * boardPad;
		totalH = cellH + 2 * boardPad;
		canvasEl.width = Math.ceil(totalW * dpr);
		canvasEl.height = Math.ceil(totalH * dpr);
		canvasEl.style.width = `${totalW}px`;
		canvasEl.style.height = `${totalH}px`;
		ctx = canvasEl.getContext('2d');
		if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	// ── Drawing helpers ────────────────────────────────────────────────────────
	function rrPath(
		c: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number,
	) {
		r = Math.min(r, w / 2, h / 2);
		c.beginPath();
		c.moveTo(x + r, y);
		c.arcTo(x + w, y, x + w, y + h, r);
		c.arcTo(x + w, y + h, x, y + h, r);
		c.arcTo(x, y + h, x, y, r);
		c.arcTo(x, y, x + w, y, r);
		c.closePath();
	}

	function makeGrad(
		c: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		isTop: boolean,
	): CanvasGradient {
		const a = (170 * Math.PI) / 180;
		const sinA = Math.sin(a),
			cosA = Math.cos(a);
		const len = Math.abs(w * sinA) + Math.abs(h * cosA);
		const mx = x + w / 2,
			my = y + h / 2;
		const g = c.createLinearGradient(
			mx - (len / 2) * sinA,
			my + (len / 2) * cosA,
			mx + (len / 2) * sinA,
			my - (len / 2) * cosA,
		);
		if (isTop) {
			g.addColorStop(0, '#414141');
			g.addColorStop(0.5, '#303030');
		} else {
			g.addColorStop(0.5, '#383838');
			g.addColorStop(1, '#272727');
		}
		return g;
	}

	function textColor(i: number): string {
		const used = usedLetters?.has(i);
		const sel =
			Math.abs(selectionEnd - selectionStart) >= 1
				? i >= selectionStart && i < selectionEnd
				: i >= selectionStart && i <= selectionEnd;
		if (success) return used ? '#83b3ad' : '#00b7a1';
		if (error) return used ? '#b38383' : '#ef6262';
		if (sel) return '#ffffff';
		if (used) return '#666666';
		return '#dddddd';
	}

	function isSel(i: number): boolean {
		return Math.abs(selectionEnd - selectionStart) >= 1
			? i >= selectionStart && i < selectionEnd
			: i >= selectionStart && i <= selectionEnd;
	}

	// ── Pre-rendered alphabet atlas ────────────────────────────────────────────
	// Renders every letter in the alphabet to offscreen canvases ONCE (per resize).
	// Key: `${letter}|${isTop ? 'T' : 'B'}|${color}` → HTMLCanvasElement
	let atlasCache = new Map<string, HTMLCanvasElement>();

	function buildAtlas(color: string) {
		atlasCache.clear();
		for (const letter of alphabet) {
			for (const isTop of [true, false]) {
				const key = `${letter}|${isTop ? 'T' : 'B'}|${color}`;
				const off = document.createElement('canvas');
				off.width = Math.ceil(cellW * dpr);
				off.height = Math.ceil(cellH * dpr);
				const oc = off.getContext('2d')!;
				oc.setTransform(dpr, 0, 0, dpr, 0, 0);
				oc.fillStyle = makeGrad(oc, 0, 0, cellW, cellH, isTop);
				oc.fillRect(0, 0, cellW, cellH);
				if (letter) {
					oc.font = fontStr;
					oc.textAlign = 'center';
					oc.textBaseline = 'middle';
					oc.fillStyle = color;
					oc.fillText(letter, cellW / 2, cellH / 2 + textYOffset);
				}
				atlasCache.set(key, off);
			}
		}
	}

	function getAtlas(letter: string, isTop: boolean, color: string): HTMLCanvasElement | undefined {
		return atlasCache.get(`${letter}|${isTop ? 'T' : 'B'}|${color}`);
	}

	// ── Static half (drawn directly, no offscreen) ─────────────────────────────
	function drawHalf(
		c: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		isTop: boolean,
		letter: string,
		color: string,
	) {
		const clipY = isTop ? cy : cy + bottomClipY;
		const clipH = isTop ? topClipY : cellH - bottomClipY;
		c.save();
		c.beginPath();
		c.rect(cx, clipY, cellW, clipH);
		c.clip();
		c.fillStyle = makeGrad(c, cx, cy, cellW, cellH, isTop);
		c.fillRect(cx, cy, cellW, cellH);
		if (letter) {
			c.font = fontStr;
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			c.fillStyle = color;
			c.fillText(letter, cx + cellW / 2, cy + cellH / 2 + textYOffset);
		}
		c.restore();
	}

	// ── Animated flap (perspective strips via drawImage) ────────────────────────
	function drawFlap(
		c: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		off: HTMLCanvasElement,
		isTop: boolean,
		theta: number,
		brightness: number,
	) {
		const rotY = cellH / 2;
		const ft = isTop ? 0 : bottomClipY;
		const fb = isTop ? topClipY : cellH;
		const fh = fb - ft;
		if (fh <= 0) return;
		const sh = fh / STRIPS;
		const cosT = Math.cos(theta),
			sinT = Math.sin(theta);
		const dimAlpha = brightness < 1 ? 1 - brightness : 0;
		const dimColor = dimAlpha > 0 ? `rgba(0,0,0,${dimAlpha})` : '';
		const ow = off.width,
			odpr = ow / cellW;

		// Clip to the correct half (prevents spring overshoot from leaking into the other half)
		c.save();
		c.beginPath();
		if (isTop) {
			c.rect(cx - cellW * 0.2, cy, cellW * 1.4, topClipY);
		} else {
			c.rect(cx - cellW * 0.2, cy + bottomClipY, cellW * 1.4, cellH - bottomClipY);
		}
		c.clip();

		for (let s = 0; s < STRIPS; s++) {
			const sy0 = ft + s * sh;
			const ly0 = sy0 - rotY,
				ly1 = ly0 + sh;
			const z0 = ly0 * sinT,
				z1 = ly1 * sinT;
			const ps0 = PERSP / (PERSP - z0),
				ps1 = PERSP / (PERSP - z1);
			if (ps0 <= 0 || ps1 <= 0) continue;
			const py0 = rotY + ly0 * cosT * ps0;
			const py1 = rotY + ly1 * cosT * ps1;
			const dY = cy + Math.min(py0, py1);
			const dH = Math.abs(py1 - py0);
			if (dH < 0.05) continue;
			const avgS = (ps0 + ps1) / 2;
			const dW = cellW * avgS;
			const dX = cx + (cellW - dW) / 2;

			// drawImage from offscreen (source is in offscreen pixel coords)
			c.drawImage(off, 0, sy0 * odpr, ow, sh * odpr, dX, dY, dW, dH);

			if (dimColor) {
				c.fillStyle = dimColor;
				c.fillRect(dX, dY, dW, dH);
			}
		}
		c.restore(); // half-clip
	}

	// ── Full frame ─────────────────────────────────────────────────────────────
	function renderFrame(now: number) {
		if (!ctx) return;
		const c = ctx;
		c.clearRect(0, 0, totalW, totalH);

		// Board background
		rrPath(c, 0, 0, totalW, totalH, boardR);
		c.fillStyle = '#282828';
		c.fill();
		// Inset shadow (top-left edge darkening)
		c.save();
		rrPath(c, 0, 0, totalW, totalH, boardR);
		c.clip();
		const insetBlur = Math.max(1, 0.08 * em);
		const topGrad = c.createLinearGradient(0, 0, 0, insetBlur + 2);
		topGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
		topGrad.addColorStop(1, 'rgba(0,0,0,0)');
		c.fillStyle = topGrad;
		c.fillRect(0, 0, totalW, insetBlur + 2);
		const leftGrad = c.createLinearGradient(0, 0, insetBlur + 2, 0);
		leftGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
		leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
		c.fillStyle = leftGrad;
		c.fillRect(0, 0, insetBlur + 2, totalH);
		c.restore();

		const n = numCells;
		for (let i = 0; i < n; i++) {
			const cx = boardPad + i * (cellW + cellGap);
			const cy = boardPad;
			const color = textColor(i);

			// Cell shadow (simplified: single dark offset rect behind cell)
			c.fillStyle = 'rgba(0,0,0,0.35)';
			c.fillRect(cx + 1, cy + 1, cellW + 1, cellH + 1);

			// Clip cell content
			c.save();
			c.beginPath();
			c.rect(cx, cy, cellW, cellH);
			c.clip();

			const ca = cellAnims[i];
			if (!ca || ca.length === 0) {
				// Static cell
				const letter = alphabet[alphaIdx[i]] || '';
				drawHalf(c, cx, cy, true, letter, color);
				drawHalf(c, cx, cy, false, letter, color);
			} else {
				// Static top: show newest step's target (revealed behind flipping tops)
				const newest = ca[ca.length - 1];
				drawHalf(c, cx, cy, true, newest.newLetter, color);
				// Static bottom: show the letter from BEFORE the animation started.
				// The oldest active step's oldLetter is the pre-animation resting letter.
				const oldest = ca[0];
				drawHalf(c, cx, cy, false, oldest.oldLetter, color);

				// Top flaps: oldest-to-newest, each showing oldLetter top half folding down
				for (let j = ca.length - 1; j >= 0; j--) {
					const a = ca[j];
					const el = now - a.startTime;
					if (el < DUR) {
						// Still in first half: top flap shows old letter, folds from 0 to -PI/2
						const t = el / DUR;
						const theta = -t * (Math.PI / 2);
						const brightness = 1 - t * 0.5;
						const off = getAtlas(a.oldLetter, true, color);
						if (off) drawFlap(c, cx, cy, off, true, theta, brightness);
					}
				}

				// Bottom flaps: each showing newLetter bottom half unfolding
				for (let j = 0; j < ca.length; j++) {
					const a = ca[j];
					const el = now - a.startTime;
					if (el >= DUR) {
						const t2 = (el - DUR) / SPRING_DUR;
						if (t2 >= 1) {
							// Spring complete — draw as clean static half (avoids strip rounding artifacts)
							drawHalf(c, cx, cy, false, a.newLetter, color);
							continue;
						}
						const s = spring(t2);
						const theta = (Math.PI / 2) * (1 - s);
						const brightness = 0.5 + 0.5 * s;
						const off = getAtlas(a.newLetter, false, color);
						if (off) drawFlap(c, cx, cy, off, false, theta, brightness);
					}
				}
			}
			c.restore();

			// Gap line
			const gx = Math.max(0, cx - boardPad);
			const gw = Math.min(totalW, cx + cellW + boardPad) - gx;
			c.fillStyle = '#222222';
			c.fillRect(gx, cy + topClipY, gw, flapGap);

			// Selected outline
			if (isSel(i)) {
				c.save();
				c.strokeStyle = '#aaaaaa';
				c.lineWidth = Math.max(1, 0.03 * em);
				rrPath(c, cx, cy, cellW, cellH, cellR);
				c.stroke();
				c.restore();
			}

			// Hover overlay
			if (hoverCell === i && onclick && !usedLetters?.has(i)) {
				c.save();
				c.fillStyle = 'rgba(255,255,255,0.1)';
				c.fillRect(cx, cy, cellW, topClipY);
				c.fillRect(cx, cy + bottomClipY, cellW, cellH - bottomClipY);
				c.restore();
			}
		}
	}

	// ── Animation state ────────────────────────────────────────────────────────
	interface StepAnim {
		startTime: number;
		oldLetter: string;
		newLetter: string;
	}
	let alphaIdx: number[] = [];
	let nextStepAt: number[] = [];
	let cellAnims: StepAnim[][] = [];

	function ensureState(n: number) {
		while (alphaIdx.length < n) {
			alphaIdx.push(0);
			nextStepAt.push(0);
			cellAnims.push([]);
		}
	}

	let rafId = 0;
	let running = false;

	function startLoop() {
		if (running) return;
		running = true;
		rafId = requestAnimationFrame((t) => tick(t));
	}

	function tick(now: number) {
		let active = false;
		const n = numCells;
		for (let i = 0; i < n; i++) {
			if (nextStepAt[i] > 0 && now >= nextStepAt[i]) advanceStep(i, now);
			const ca = cellAnims[i];
			if (ca) {
				// Prune completed animations
				for (let j = ca.length - 1; j >= 0; j--) {
					if (now - ca[j].startTime >= DUR + SPRING_DUR) ca.splice(j, 1);
				}
				if (ca.length > 0) active = true;
			}
			if (nextStepAt[i] > 0) active = true;
		}
		renderFrame(now);
		if (active) rafId = requestAnimationFrame((t) => tick(t));
		else running = false;
	}

	function advanceStep(i: number, now: number) {
		const cur = alphaIdx[i];
		const nxt = (cur + 1) % alphabet.length;

		// Cap overlapping animations
		while (cellAnims[i].length >= MAX_OVERLAPPING) cellAnims[i].shift();

		cellAnims[i].push({
			startTime: now,
			oldLetter: alphabet[cur] || '',
			newLetter: alphabet[nxt] || '',
		});
		alphaIdx[i] = nxt;
		const ti = alphabet.indexOf(letters[i]);
		nextStepAt[i] = nxt !== ti && ti >= 0 ? now + STAG : 0;
	}

	// ── Effects ────────────────────────────────────────────────────────────────
	$effect(() => {
		if (!canvasEl || !wrapper) return;
		const l = letters;
		let needsAnim = false;
		untrack(() => {
			recomputeSizes();
			ensureState(numCells);
			buildAtlas('#dddddd');
			const now = performance.now();
			for (let i = 0; i < numCells; i++) {
				const ti = alphabet.indexOf(l[i]);
				if (ti < 0 || alphaIdx[i] === ti) continue;
				if (sound) {
					const d = alphaIdx[i] <= ti ? ti - alphaIdx[i] : alphabet.length - alphaIdx[i] + ti;
					setTimeout(
						() =>
							playSplitFlapSound({
								ticks: Math.min(d, 40),
								delay: STAG + 10,
								volume,
							}),
						200,
					);
				}
				if (nextStepAt[i] === 0) {
					nextStepAt[i] = now;
					needsAnim = true;
				}
			}
			if (!needsAnim) renderFrame(now);
		});
		// Start animation loop OUTSIDE untrack to ensure rAF fires
		if (needsAnim) startLoop();
	});

	$effect(() => {
		if (success && sound) playSuccessSound();
	});
	$effect(() => {
		if (error && sound) playFailureSound();
	});

	// Re-render on visual prop changes
	$effect(() => {
		const _deps = [selectionStart, selectionEnd, success, error, usedLetters];
		void _deps;
		// Rebuild atlas with updated colors for all cells
		if (cellW > 0) {
			const colors = new Set<string>();
			for (let i = 0; i < numCells; i++) colors.add(textColor(i));
			for (const col of colors) buildAtlas(col);
		}
		if (ctx && !running) renderFrame(performance.now());
	});

	// Resize observer
	let resizeObs: ResizeObserver | undefined;
	$effect(() => {
		if (!wrapper) return;
		resizeObs = new ResizeObserver(() => {
			recomputeSizes();
			if (!running) renderFrame(performance.now());
		});
		resizeObs.observe(wrapper);
		return () => resizeObs?.disconnect();
	});

	// Font loading
	$effect(() => {
		if (!browser) return;
		document.fonts.ready.then(() => {
			if (ctx && !running) renderFrame(performance.now());
		});
	});

	// ── Interactivity ──────────────────────────────────────────────────────────
	let hoverCell = -1;

	function cellAt(e: PointerEvent): number {
		if (!canvasEl) return -1;
		const r = canvasEl.getBoundingClientRect();
		const x = (e.clientX - r.left) * (totalW / r.width);
		const y = (e.clientY - r.top) * (totalH / r.height);
		for (let i = 0; i < numCells; i++) {
			const cx = boardPad + i * (cellW + cellGap);
			if (x >= cx && x < cx + cellW && y >= boardPad && y < boardPad + cellH) return i;
		}
		return -1;
	}

	function onPtrMove(e: PointerEvent) {
		if (!onclick) return;
		const i = cellAt(e);
		if (i !== hoverCell) {
			hoverCell = i;
			if (!running) renderFrame(performance.now());
		}
		if (canvasEl) canvasEl.style.cursor = i >= 0 && !usedLetters?.has(i) ? 'pointer' : '';
	}
	function onPtrLeave() {
		if (hoverCell >= 0) {
			hoverCell = -1;
			if (!running) renderFrame(performance.now());
		}
		if (canvasEl) canvasEl.style.cursor = '';
	}
	function onPtrDown(e: PointerEvent) {
		if (!onclick) return;
		const i = cellAt(e);
		if (i >= 0 && !usedLetters?.has(i)) onclick(i);
	}

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		resizeObs?.disconnect();
	});
</script>

<div
	class={['flip-text', className].filter(Boolean).join(' ')}
	class:success
	class:error
	bind:this={wrapper}
>
	<canvas
		bind:this={canvasEl}
		onpointermove={onPtrMove}
		onpointerleave={onPtrLeave}
		onpointerdown={onPtrDown}
	></canvas>
</div>

<style lang="scss">
	div {
		display: inline-flex;
		position: relative;
		font-size: 1em;
		line-height: 1em;
		font-family: 'Roboto Mono', monospace;
		font-weight: 500;
	}
	canvas {
		display: block;
	}
</style>
