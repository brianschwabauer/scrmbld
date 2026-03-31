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
		initialDelay = 0,
	} = $props();

	const STRIPS = 12;
	const PERSP = 80;
	const SPRING_DUR = 1000;
	const MAX_OVERLAPPING = 8;
	const DUR = $derived(duration);
	const STAG = $derived(stagger ?? Math.floor(duration * 0.2));
	const COLOR = '#dddddd';

	// 0 = all letters flip in perfect unison, 1 = maximum random variation
	const JITTER = 0.4;

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

	// ── Offscreen caches ───────────────────────────────────────────────────────
	let spriteSheet: HTMLCanvasElement | undefined;
	let tileW = 0;
	let tileH = 0;
	let alphaMap = new Map<string, number>();
	let boardBgCanvas: HTMLCanvasElement | undefined;
	let contentCanvas: HTMLCanvasElement | undefined;
	let contentCtx: CanvasRenderingContext2D | null = null;
	let activeCells = new Set<number>();

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

	// ── Alphabet lookup ────────────────────────────────────────────────────────
	function buildAlphaMap() {
		alphaMap.clear();
		for (let i = 0; i < alphabet.length; i++) {
			alphaMap.set(alphabet[i], i);
		}
	}

	// ── Single sprite-sheet atlas ──────────────────────────────────────────────
	function buildSpriteSheet() {
		if (!spriteSheet) spriteSheet = document.createElement('canvas');
		tileW = Math.ceil(cellW * dpr);
		tileH = Math.ceil(cellH * dpr);
		const n = alphabet.length;
		if (n === 0 || tileW === 0 || tileH === 0) return;
		spriteSheet.width = n * tileW;
		spriteSheet.height = 2 * tileH;
		const sc = spriteSheet.getContext('2d')!;

		for (let i = 0; i < n; i++) {
			const letter = alphabet[i];

			// Top variant
			sc.save();
			sc.translate(i * tileW, 0);
			sc.scale(dpr, dpr);
			sc.fillStyle = makeGrad(sc, 0, 0, cellW, cellH, true);
			sc.fillRect(0, 0, cellW, cellH);
			if (letter) {
				sc.font = fontStr;
				sc.textAlign = 'center';
				sc.textBaseline = 'middle';
				sc.fillStyle = COLOR;
				sc.fillText(letter, cellW / 2, cellH / 2 + textYOffset);
			}
			sc.restore();

			// Bottom variant
			sc.save();
			sc.translate(i * tileW, tileH);
			sc.scale(dpr, dpr);
			sc.fillStyle = makeGrad(sc, 0, 0, cellW, cellH, false);
			sc.fillRect(0, 0, cellW, cellH);
			if (letter) {
				sc.font = fontStr;
				sc.textAlign = 'center';
				sc.textBaseline = 'middle';
				sc.fillStyle = COLOR;
				sc.fillText(letter, cellW / 2, cellH / 2 + textYOffset);
			}
			sc.restore();
		}
	}

	// ── Board background cache ─────────────────────────────────────────────────
	function buildBoardBg() {
		if (!boardBgCanvas) boardBgCanvas = document.createElement('canvas');
		const pw = Math.ceil(totalW * dpr);
		const ph = Math.ceil(totalH * dpr);
		if (pw === 0 || ph === 0) return;
		boardBgCanvas.width = pw;
		boardBgCanvas.height = ph;
		const bc = boardBgCanvas.getContext('2d')!;
		bc.setTransform(dpr, 0, 0, dpr, 0, 0);

		const nRows = rowCount;
		const nCols = cols;

		for (let row = 0; row < nRows; row++) {
			const ry = row * (rowH + rowGap);

			// Row background
			rrPath(bc, 0, ry, rowW, rowH, boardR);
			bc.fillStyle = '#282828';
			bc.fill();

			// Inset shadow
			bc.save();
			rrPath(bc, 0, ry, rowW, rowH, boardR);
			bc.clip();
			const ib = Math.max(1, 0.08 * em);
			const tg = bc.createLinearGradient(0, ry, 0, ry + ib + 2);
			tg.addColorStop(0, 'rgba(0,0,0,0.3)');
			tg.addColorStop(1, 'rgba(0,0,0,0)');
			bc.fillStyle = tg;
			bc.fillRect(0, ry, rowW, ib + 2);
			const lg = bc.createLinearGradient(0, 0, ib + 2, 0);
			lg.addColorStop(0, 'rgba(0,0,0,0.3)');
			lg.addColorStop(1, 'rgba(0,0,0,0)');
			bc.fillStyle = lg;
			bc.fillRect(0, ry, ib + 2, rowH);
			bc.restore();

			// Cell shadows and gap lines
			for (let col = 0; col < nCols; col++) {
				const cx = boardPad + col * (cellW + cellGap);
				const cy = ry + boardPad;

				// Cell shadow
				bc.fillStyle = 'rgba(0,0,0,0.35)';
				bc.fillRect(cx + 1, cy + 1, cellW + 1, cellH + 1);

				// Gap line (cell content is clipped to top/bottom halves, so this stays visible)
				const gx = Math.max(0, cx - boardPad);
				const gw = Math.min(rowW, cx + cellW + boardPad) - gx;
				bc.fillStyle = '#222222';
				bc.fillRect(gx, cy + topClipY, gw, flapGap);
			}
		}
	}

	// ── Content canvas (full static frame) ─────────────────────────────────────
	function buildContentCanvas() {
		if (!contentCanvas) contentCanvas = document.createElement('canvas');
		const pw = Math.ceil(totalW * dpr);
		const ph = Math.ceil(totalH * dpr);
		if (pw === 0 || ph === 0) return;
		contentCanvas.width = pw;
		contentCanvas.height = ph;
		contentCtx = contentCanvas.getContext('2d')!;
		contentCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

		// Draw background
		if (boardBgCanvas) {
			contentCtx.drawImage(
				boardBgCanvas,
				0,
				0,
				boardBgCanvas.width,
				boardBgCanvas.height,
				0,
				0,
				totalW,
				totalH,
			);
		}

		// Draw all cells from sprite sheet
		const nCols = cols;
		for (let row = 0; row < rowCount; row++) {
			const ry = row * (rowH + rowGap);
			for (let col = 0; col < nCols; col++) {
				const idx = row * nCols + col;
				const cx = boardPad + col * (cellW + cellGap);
				const cy = ry + boardPad;
				const letter = alphabet[alphaIdx[idx]] || '';
				drawAtlasHalf(contentCtx, cx, cy, true, letter);
				drawAtlasHalf(contentCtx, cx, cy, false, letter);
			}
		}
	}

	function updateCellInContent(idx: number) {
		if (!contentCtx || !boardBgCanvas || !spriteSheet) return;
		const nCols = cols;
		const row = Math.floor(idx / nCols);
		const col = idx % nCols;
		const ry = row * (rowH + rowGap);
		const cx = boardPad + col * (cellW + cellGap);
		const cy = ry + boardPad;

		// Restore background for this cell region from cache
		const sx = Math.round(cx * dpr);
		const sy = Math.round(cy * dpr);
		const sw = Math.ceil(cellW * dpr);
		const sh = Math.ceil(cellH * dpr);
		contentCtx.drawImage(boardBgCanvas, sx, sy, sw, sh, cx, cy, cellW, cellH);

		// Draw updated cell content
		const letter = alphabet[alphaIdx[idx]] || '';
		drawAtlasHalf(contentCtx, cx, cy, true, letter);
		drawAtlasHalf(contentCtx, cx, cy, false, letter);
	}

	function rebuildCaches() {
		buildAlphaMap();
		buildSpriteSheet();
		buildBoardBg();
		buildContentCanvas();
	}

	// ── Atlas half drawing ─────────────────────────────────────────────────────
	function drawAtlasHalf(
		c: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		isTop: boolean,
		letter: string,
	) {
		if (!spriteSheet) return;
		const li = alphaMap.get(letter);
		if (li === undefined) return;

		const srcX = li * tileW;
		if (isTop) {
			const srcH = Math.ceil(topClipY * dpr);
			c.drawImage(spriteSheet, srcX, 0, tileW, srcH, cx, cy, cellW, topClipY);
		} else {
			const offY = Math.ceil(bottomClipY * dpr);
			const srcH = tileH - offY;
			c.drawImage(
				spriteSheet,
				srcX,
				tileH + offY,
				tileW,
				srcH,
				cx,
				cy + bottomClipY,
				cellW,
				cellH - bottomClipY,
			);
		}
	}

	// ── Animated flap ──────────────────────────────────────────────────────────
	function drawFlap(
		c: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		srcX: number,
		srcY: number,
		isTop: boolean,
		theta: number,
		brightness: number,
	) {
		if (!spriteSheet) return;
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
			const dH = Math.abs(py1 - py0) + 0.5;
			if (dH < 0.05) continue;
			const avgS = (ps0 + ps1) / 2;
			const dW = cellW * avgS;
			const dX = cx + (cellW - dW) / 2;

			c.drawImage(
				spriteSheet,
				srcX,
				srcY + Math.round(sy0 * dpr),
				tileW,
				Math.max(1, Math.round(sh * dpr)),
				dX,
				dY,
				dW,
				dH,
			);

			if (dimColor) {
				c.fillStyle = dimColor;
				c.fillRect(dX, dY, dW, dH);
			}
		}
		c.restore();
	}

	// ── Full frame render ──────────────────────────────────────────────────────
	function renderFrame(now: number) {
		if (!ctx || !contentCanvas) return;
		const c = ctx;

		// Stamp full content layer (background + static cell content)
		c.drawImage(
			contentCanvas,
			0,
			0,
			contentCanvas.width,
			contentCanvas.height,
			0,
			0,
			totalW,
			totalH,
		);

		if (activeCells.size === 0) return;

		// Overdraw only active cells
		const nCols = cols;
		for (const idx of activeCells) {
			const row = Math.floor(idx / nCols);
			const col = idx % nCols;
			const ry = row * (rowH + rowGap);
			const cx = boardPad + col * (cellW + cellGap);
			const cy = ry + boardPad;

			// Restore cell background from cache
			if (boardBgCanvas) {
				const sx = Math.round(cx * dpr);
				const sy = Math.round(cy * dpr);
				c.drawImage(
					boardBgCanvas,
					sx,
					sy,
					Math.ceil(cellW * dpr),
					Math.ceil(cellH * dpr),
					cx,
					cy,
					cellW,
					cellH,
				);
			}

			const ca = cellAnims[idx];
			if (!ca || ca.length === 0) {
				const letter = alphabet[alphaIdx[idx]] || '';
				drawAtlasHalf(c, cx, cy, true, letter);
				drawAtlasHalf(c, cx, cy, false, letter);
				continue;
			}

			const newest = ca[ca.length - 1];
			const oldest = ca[0];

			// Revealed halves
			drawAtlasHalf(c, cx, cy, true, newest.newLetter);
			drawAtlasHalf(c, cx, cy, false, oldest.oldLetter);

			// Top flaps (falling)
			for (let j = ca.length - 1; j >= 0; j--) {
				const a = ca[j];
				const el = now - a.startTime;
				if (el < DUR) {
					const t = el / DUR;
					const li = alphaMap.get(a.oldLetter);
					if (li !== undefined) {
						drawFlap(c, cx, cy, li * tileW, 0, true, -t * (Math.PI / 2), 1 - t * 0.5);
					}
				}
			}

			// Bottom flaps (springing up)
			for (let j = 0; j < ca.length; j++) {
				const a = ca[j];
				const el = now - a.startTime;
				if (el >= DUR) {
					const t2 = (el - DUR) / SPRING_DUR;
					if (t2 >= 1) {
						drawAtlasHalf(c, cx, cy, false, a.newLetter);
						continue;
					}
					const s = spring(t2);
					const li = alphaMap.get(a.newLetter);
					if (li !== undefined) {
						drawFlap(c, cx, cy, li * tileW, tileH, false, (Math.PI / 2) * (1 - s), 0.5 + 0.5 * s);
					}
				}
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
	let cellStartDelay: number[] = [];
	let cellSpeedMult: number[] = [];

	function ensureState(n: number) {
		while (alphaIdx.length < n) {
			alphaIdx.push(0);
			nextStepAt.push(0);
			cellAnims.push([]);
			cellStartDelay.push(0);
			cellSpeedMult.push(1);
		}
	}

	let rafId = 0;
	let running = false;
	let hasAnimated = false;
	let delayTimer = 0;

	function startLoop() {
		if (running) return;
		running = true;
		rafId = requestAnimationFrame((t) => tick(t));
	}

	function tick(now: number) {
		const settled: number[] = [];

		for (const idx of activeCells) {
			if (nextStepAt[idx] > 0 && now >= nextStepAt[idx]) advanceStep(idx, now);

			const ca = cellAnims[idx];
			if (ca) {
				for (let j = ca.length - 1; j >= 0; j--) {
					if (now - ca[j].startTime >= DUR + SPRING_DUR) ca.splice(j, 1);
				}
			}

			if ((!ca || ca.length === 0) && nextStepAt[idx] <= 0) {
				settled.push(idx);
			}
		}

		for (const idx of settled) {
			activeCells.delete(idx);
			updateCellInContent(idx);
		}

		renderFrame(now);

		if (activeCells.size > 0) {
			rafId = requestAnimationFrame((t) => tick(t));
		} else {
			running = false;
		}
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
		const ti = alphaMap.get(targetChars[i]) ?? -1;
		nextStepAt[i] = nxt !== ti && ti >= 0 ? now + STAG * cellSpeedMult[i] : 0;
	}

	// ── Effects ────────────────────────────────────────────────────────────────
	let prevStructure = '';

	$effect(() => {
		if (!canvasEl || !wrapper) return;
		const tc = targetChars;
		let needsAnim = false;
		let maxDist = 0;
		untrack(() => {
			const structure = `${rowCount}x${cols}`;
			if (structure !== prevStructure) {
				prevStructure = structure;
				alphaIdx = [];
				nextStepAt = [];
				cellAnims = [];
				cellStartDelay = [];
				cellSpeedMult = [];
				activeCells.clear();
			}
			recomputeSizes();
			ensureState(cellCount);
			rebuildCaches();

			const now = performance.now();

			// Generate fresh per-cell jitter for this animation batch
			for (let i = 0; i < cellCount; i++) {
				cellStartDelay[i] = Math.random() * JITTER * DUR;
				cellSpeedMult[i] = 1 + (Math.random() * 2 - 1) * JITTER * 0.5;
			}

			for (let i = 0; i < cellCount; i++) {
				const ti = alphaMap.get(tc[i]) ?? -1;
				if (ti < 0 || alphaIdx[i] === ti) continue;
				if (sound) {
					const d = alphaIdx[i] <= ti ? ti - alphaIdx[i] : alphabet.length - alphaIdx[i] + ti;
					if (d > maxDist) maxDist = d;
				}
				if (nextStepAt[i] === 0) {
					nextStepAt[i] = now + cellStartDelay[i];
					activeCells.add(i);
					needsAnim = true;
				}
			}

			if (!needsAnim) renderFrame(now);
		});
		if (needsAnim) {
			const soundDelay = 200;
			const playSound = () => {
				if (sound && maxDist > 0) {
					setTimeout(
						() =>
							playSplitFlapSound({
								ticks: Math.min(maxDist, 40),
								delay: STAG + 10,
								volume,
							}),
						soundDelay,
					);
				}
			};
			if (!hasAnimated && initialDelay > 0) {
				hasAnimated = true;
				// Render static frame, then start animation after delay
				renderFrame(performance.now());
				delayTimer = window.setTimeout(() => {
					// Re-anchor start times so the delay doesn't eat into the animation
					const now2 = performance.now();
					for (const idx of activeCells) {
						nextStepAt[idx] = now2 + cellStartDelay[idx];
					}
					playSound();
					startLoop();
				}, initialDelay);
			} else {
				hasAnimated = true;
				playSound();
				startLoop();
			}
		}
	});

	// Resize observer
	let resizeObs: ResizeObserver | undefined;
	$effect(() => {
		if (!wrapper) return;
		resizeObs = new ResizeObserver(() => {
			recomputeSizes();
			rebuildCaches();
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
			rebuildCaches();
			if (!running) renderFrame(performance.now());
		});
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		if (delayTimer) clearTimeout(delayTimer);
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
