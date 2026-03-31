<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { playSplitFlapSound } from './audio';

	let {
		lines = [] as string[],
		cols = 10,
		duration = 300,
		stagger = undefined as number | undefined,
		sound = false,
		volume = 1,
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
		] as string[],
	} = $props();

	const STRIPS = 12;
	const PERSP = 80;
	const SPRING_DUR = 1000;
	const MAX_OVERLAPPING = 8;
	const DUR = $derived(duration);
	const STAG = $derived(stagger ?? Math.floor(duration * 0.2));
	const COLOR = '#dddddd';

	// ── Spring easing ──────────────────────────────────────────────────────────
	const SP: [number, number][] = [
		[0, 0],
		[0.0105, 0.009],
		[0.021, 0.035],
		[0.044, 0.141],
		[0.067, 0.281],
		[0.129, 0.723],
		[0.167, 0.892],
		[0.186, 1.03],
		[0.205, 1.135],
		[0.224, 1.212],
		[0.243, 1.261],
		[0.257, 1.278],
		[0.271, 1.285],
		[0.285, 1.282],
		[0.299, 1.27],
		[0.328, 1.226],
		[0.396, 1.089],
		[0.431, 1.03],
		[0.471, 0.984],
		[0.51, 0.96],
		[0.538, 0.955],
		[0.571, 0.956],
		[0.698, 0.995],
		[0.769, 1.005],
		[0.838, 1.007],
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

	// ── Targets (flat array, row-major) ────────────────────────────────────────
	const targetChars = $derived.by(() => {
		const flat: string[] = [];
		for (const line of lines) {
			const u = line.toUpperCase();
			for (let c = 0; c < cols; c++) flat.push(c < u.length ? u[c] : '');
		}
		return flat;
	});
	const rowCount = $derived(lines.length);
	const cellCount = $derived(rowCount * cols);

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
		boardR = 0;
	let topClipY = 0,
		bottomClipY = 0;
	let rowW = 0,
		rowH = 0,
		rowGap = 0;
	let totalW = 0,
		totalH = 0;
	let textYOffset = 0;
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
		topClipY = cellH / 2 - flapGap / 2;
		bottomClipY = cellH / 2 + flapGap / 2;
		fontStr = `500 ${pfs}px "Roboto Mono", monospace`;
		rowGap = 0.15 * em;
		if (ctx || canvasEl) {
			const mc = (ctx || canvasEl!.getContext('2d'))!;
			mc.font = fontStr;
			mc.textBaseline = 'middle';
			const m = mc.measureText('H');
			const a = m.actualBoundingBoxAscent ?? 0;
			const d = m.actualBoundingBoxDescent ?? 0;
			textYOffset = (a - d) / 2;
		}
		rowW = cols * cellW + Math.max(0, cols - 1) * cellGap + 2 * boardPad;
		rowH = cellH + 2 * boardPad;
		totalW = rowW;
		totalH = Math.max(0, rowCount * rowH + Math.max(0, rowCount - 1) * rowGap);
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

	// ── Pre-rendered alphabet atlas ────────────────────────────────────────────
	let atlasCache = new Map<string, HTMLCanvasElement>();

	function buildAtlas() {
		atlasCache.clear();
		for (const letter of alphabet) {
			for (const isTop of [true, false]) {
				const key = `${letter}|${isTop ? 'T' : 'B'}`;
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
					oc.fillStyle = COLOR;
					oc.fillText(letter, cellW / 2, cellH / 2 + textYOffset);
				}
				atlasCache.set(key, off);
			}
		}
	}

	function getAtlas(letter: string, isTop: boolean): HTMLCanvasElement | undefined {
		return atlasCache.get(`${letter}|${isTop ? 'T' : 'B'}`);
	}

	// ── Static half ────────────────────────────────────────────────────────────
	function drawHalf(
		c: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		isTop: boolean,
		letter: string,
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
			c.fillStyle = COLOR;
			c.fillText(letter, cx + cellW / 2, cy + cellH / 2 + textYOffset);
		}
		c.restore();
	}

	// ── Animated flap ──────────────────────────────────────────────────────────
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
			const dH = Math.abs(py1 - py0) + 0.5; // +0.5 overlap to prevent sub-pixel gaps between strips
			if (dH < 0.05) continue;
			const avgS = (ps0 + ps1) / 2;
			const dW = cellW * avgS;
			const dX = cx + (cellW - dW) / 2;

			c.drawImage(off, 0, sy0 * odpr, ow, sh * odpr, dX, dY, dW, dH);

			if (dimColor) {
				c.fillStyle = dimColor;
				c.fillRect(dX, dY, dW, dH);
			}
		}
		c.restore();
	}

	// ── Full frame ─────────────────────────────────────────────────────────────
	function renderFrame(now: number) {
		if (!ctx) return;
		const c = ctx;
		c.clearRect(0, 0, totalW + 1, totalH + 1);

		const nRows = rowCount;
		const nCols = cols;

		for (let row = 0; row < nRows; row++) {
			const ry = row * (rowH + rowGap);

			// Row board background
			rrPath(c, 0, ry, rowW, rowH, boardR);
			c.fillStyle = '#282828';
			c.fill();

			// Inset shadow
			c.save();
			rrPath(c, 0, ry, rowW, rowH, boardR);
			c.clip();
			const ib = Math.max(1, 0.08 * em);
			const tg = c.createLinearGradient(0, ry, 0, ry + ib + 2);
			tg.addColorStop(0, 'rgba(0,0,0,0.3)');
			tg.addColorStop(1, 'rgba(0,0,0,0)');
			c.fillStyle = tg;
			c.fillRect(0, ry, rowW, ib + 2);
			const lg = c.createLinearGradient(0, 0, ib + 2, 0);
			lg.addColorStop(0, 'rgba(0,0,0,0.3)');
			lg.addColorStop(1, 'rgba(0,0,0,0)');
			c.fillStyle = lg;
			c.fillRect(0, ry, ib + 2, rowH);
			c.restore();

			// Cells in this row
			for (let col = 0; col < nCols; col++) {
				const idx = row * nCols + col;
				const cx = boardPad + col * (cellW + cellGap);
				const cy = ry + boardPad;

				// Cell shadow
				c.fillStyle = 'rgba(0,0,0,0.35)';
				c.fillRect(cx + 1, cy + 1, cellW + 1, cellH + 1);

				// Clip cell
				c.save();
				c.beginPath();
				c.rect(cx, cy, cellW, cellH);
				c.clip();

				const ca = cellAnims[idx];
				if (!ca || ca.length === 0) {
					const letter = alphabet[alphaIdx[idx]] || '';
					drawHalf(c, cx, cy, true, letter);
					drawHalf(c, cx, cy, false, letter);
				} else {
					const newest = ca[ca.length - 1];
					const oldest = ca[0];
					drawHalf(c, cx, cy, true, newest.newLetter);
					drawHalf(c, cx, cy, false, oldest.oldLetter);

					// Top flaps
					for (let j = ca.length - 1; j >= 0; j--) {
						const a = ca[j];
						const el = now - a.startTime;
						if (el < DUR) {
							const t = el / DUR;
							const off = getAtlas(a.oldLetter, true);
							if (off) drawFlap(c, cx, cy, off, true, -t * (Math.PI / 2), 1 - t * 0.5);
						}
					}

					// Bottom flaps
					for (let j = 0; j < ca.length; j++) {
						const a = ca[j];
						const el = now - a.startTime;
						if (el >= DUR) {
							const t2 = (el - DUR) / SPRING_DUR;
							if (t2 >= 1) {
								drawHalf(c, cx, cy, false, a.newLetter);
								continue;
							}
							const s = spring(t2);
							const off = getAtlas(a.newLetter, false);
							if (off) drawFlap(c, cx, cy, off, false, (Math.PI / 2) * (1 - s), 0.5 + 0.5 * s);
						}
					}
				}
				c.restore();

				// Gap line
				const gx = Math.max(0, cx - boardPad);
				const gw = Math.min(rowW, cx + cellW + boardPad) - gx;
				c.fillStyle = '#222222';
				c.fillRect(gx, cy + topClipY, gw, flapGap);
			}
		}
	}

	// ── Animation state (flat arrays, row-major) ───────────────────────────────
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
		const n = cellCount;
		for (let i = 0; i < n; i++) {
			if (nextStepAt[i] > 0 && now >= nextStepAt[i]) advanceStep(i, now);
			const ca = cellAnims[i];
			if (ca) {
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
		while (cellAnims[i].length >= MAX_OVERLAPPING) cellAnims[i].shift();
		cellAnims[i].push({
			startTime: now,
			oldLetter: alphabet[cur] || '',
			newLetter: alphabet[nxt] || '',
		});
		alphaIdx[i] = nxt;
		const ti = alphabet.indexOf(targetChars[i]);
		nextStepAt[i] = nxt !== ti && ti >= 0 ? now + STAG : 0;
	}

	// ── Effects ────────────────────────────────────────────────────────────────
	let prevStructure = '';

	$effect(() => {
		if (!canvasEl || !wrapper) return;
		const tc = targetChars;
		let needsAnim = false;
		untrack(() => {
			const structure = `${rowCount}x${cols}`;
			if (structure !== prevStructure) {
				prevStructure = structure;
				alphaIdx = [];
				nextStepAt = [];
				cellAnims = [];
			}
			recomputeSizes();
			ensureState(cellCount);
			buildAtlas();

			const now = performance.now();
			let maxDist = 0;

			for (let i = 0; i < cellCount; i++) {
				const ti = alphabet.indexOf(tc[i]);
				if (ti < 0 || alphaIdx[i] === ti) continue;
				if (sound) {
					const d = alphaIdx[i] <= ti ? ti - alphaIdx[i] : alphabet.length - alphaIdx[i] + ti;
					if (d > maxDist) maxDist = d;
				}
				if (nextStepAt[i] === 0) {
					nextStepAt[i] = now;
					needsAnim = true;
				}
			}

			if (sound && maxDist > 0) {
				setTimeout(
					() => playSplitFlapSound({ ticks: Math.min(maxDist, 40), delay: STAG + 10, volume }),
					200,
				);
			}

			if (!needsAnim) renderFrame(now);
		});
		if (needsAnim) startLoop();
	});

	// Resize observer
	let resizeObs: ResizeObserver | undefined;
	$effect(() => {
		if (!wrapper) return;
		resizeObs = new ResizeObserver(() => {
			recomputeSizes();
			buildAtlas();
			if (!running) renderFrame(performance.now());
		});
		resizeObs.observe(wrapper);
		return () => resizeObs?.disconnect();
	});

	// Font loading
	$effect(() => {
		if (!browser) return;
		document.fonts.ready.then(() => {
			recomputeSizes();
			buildAtlas();
			if (!running) renderFrame(performance.now());
		});
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		resizeObs?.disconnect();
	});
</script>

<div bind:this={wrapper}>
	<canvas bind:this={canvasEl}></canvas>
</div>

<style lang="scss">
	div {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-size: 1em;
		line-height: 1em;
		font-family: 'Roboto Mono', monospace;
		font-weight: 500;
	}
	canvas {
		display: block;
	}
</style>
