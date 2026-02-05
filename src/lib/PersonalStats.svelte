<script lang="ts">
	type Props = {
		stats: {
			recentGames: { day: number; time: number }[];
			hintBreakdown: { noHints: number; oneHint: number; twoPlus: number };
			weekdayAvg: { day: number; avgTime: number; count: number }[];
			personalBests: {
				fastestTime: number | null;
				longestStreak: number;
				bestMonth: { month: string; count: number } | null;
			};
			percentile: number | null;
		};
	};

	let { stats }: Props = $props();

	const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function formatTime(ms: number | null): string {
		if (ms === null) return '—';
		const time = Math.round(ms / 1000);
		const minutes = Math.floor(time / 60);
		const seconds = time % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function formatMonth(monthStr: string): string {
		const [year, month] = monthStr.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1);
		return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	// SVG chart calculations
	const chartWidth = 300;
	const chartHeight = 100;
	const chartPadding = { top: 10, right: 10, bottom: 20, left: 40 };

	const trendPoints = $derived.by(() => {
		if (stats.recentGames.length < 2) return '';

		const times = stats.recentGames.map((g) => g.time);
		const minTime = Math.min(...times);
		const maxTime = Math.max(...times);
		const timeRange = maxTime - minTime || 1;

		const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
		const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;

		return stats.recentGames
			.map((game, i) => {
				const x = chartPadding.left + (i / (stats.recentGames.length - 1)) * innerWidth;
				const y = chartPadding.top + ((maxTime - game.time) / timeRange) * innerHeight;
				return `${x},${y}`;
			})
			.join(' ');
	});

	const trendMinMax = $derived.by(() => {
		if (stats.recentGames.length < 2) return { min: 0, max: 0, minLabel: '—', maxLabel: '—' };
		const times = stats.recentGames.map((g) => g.time);
		const min = Math.min(...times);
		const max = Math.max(...times);
		return {
			min,
			max,
			minLabel: formatTime(min),
			maxLabel: formatTime(max),
		};
	});

	// Hint breakdown percentages
	const hintTotal = $derived(
		stats.hintBreakdown.noHints + stats.hintBreakdown.oneHint + stats.hintBreakdown.twoPlus,
	);
	const hintPercentages = $derived({
		noHints: hintTotal > 0 ? Math.round((stats.hintBreakdown.noHints / hintTotal) * 100) : 0,
		oneHint: hintTotal > 0 ? Math.round((stats.hintBreakdown.oneHint / hintTotal) * 100) : 0,
		twoPlus: hintTotal > 0 ? Math.round((stats.hintBreakdown.twoPlus / hintTotal) * 100) : 0,
	});

	// Weekday chart data
	const weekdayMaxTime = $derived(Math.max(...stats.weekdayAvg.map((w) => w.avgTime), 1));
</script>

<div class="personal-stats">
	<h2>Your Stats</h2>

	{#if stats.percentile !== null}
		<div class="percentile-card">
			<span class="percentile-value">Top {100 - stats.percentile}%</span>
			<span class="percentile-label">Faster than {stats.percentile}% of players</span>
		</div>
	{/if}

	<div class="stats-section">
		<h3>Personal Bests</h3>
		<div class="bests-grid">
			<div class="best-card">
				<span class="icon">⚡</span>
				<span class="value">{formatTime(stats.personalBests.fastestTime)}</span>
				<span class="label">Fastest Time</span>
			</div>
			<div class="best-card">
				<span class="icon">🔥</span>
				<span class="value">{stats.personalBests.longestStreak}</span>
				<span class="label">Longest Streak</span>
			</div>
			{#if stats.personalBests.bestMonth}
				<div class="best-card">
					<span class="icon">📅</span>
					<span class="value">{stats.personalBests.bestMonth.count}</span>
					<span class="label">{formatMonth(stats.personalBests.bestMonth.month)}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if stats.recentGames.length >= 2}
		<div class="stats-section">
			<h3>Solve Time Trend (Last 90 Days)</h3>
			<div class="chart-container">
				<svg viewBox="0 0 {chartWidth} {chartHeight}" class="trend-chart">
					<!-- Grid lines -->
					<line
						x1={chartPadding.left}
						y1={chartPadding.top}
						x2={chartWidth - chartPadding.right}
						y2={chartPadding.top}
						class="grid-line"
					/>
					<line
						x1={chartPadding.left}
						y1={chartHeight - chartPadding.bottom}
						x2={chartWidth - chartPadding.right}
						y2={chartHeight - chartPadding.bottom}
						class="grid-line"
					/>

					<!-- Y-axis labels -->
					<text
						x={chartPadding.left - 5}
						y={chartPadding.top + 4}
						class="axis-label"
						text-anchor="end"
					>
						{trendMinMax.maxLabel}
					</text>
					<text
						x={chartPadding.left - 5}
						y={chartHeight - chartPadding.bottom}
						class="axis-label"
						text-anchor="end"
					>
						{trendMinMax.minLabel}
					</text>

					<!-- Data line -->
					<polyline points={trendPoints} class="trend-line" />
				</svg>
			</div>
		</div>
	{/if}

	<div class="stats-section">
		<h3>Hint Usage</h3>
		<div class="hint-bars">
			<div class="hint-row">
				<span class="hint-label">No hints</span>
				<div class="hint-bar-container">
					<div class="hint-bar" style="width: {hintPercentages.noHints}%"></div>
				</div>
				<span class="hint-pct">{hintPercentages.noHints}%</span>
			</div>
			<div class="hint-row">
				<span class="hint-label">1 hint</span>
				<div class="hint-bar-container">
					<div class="hint-bar one-hint" style="width: {hintPercentages.oneHint}%"></div>
				</div>
				<span class="hint-pct">{hintPercentages.oneHint}%</span>
			</div>
			<div class="hint-row">
				<span class="hint-label">2+ hints</span>
				<div class="hint-bar-container">
					<div class="hint-bar two-plus" style="width: {hintPercentages.twoPlus}%"></div>
				</div>
				<span class="hint-pct">{hintPercentages.twoPlus}%</span>
			</div>
		</div>
	</div>

	{#if stats.weekdayAvg.length > 0}
		<div class="stats-section">
			<h3>Performance by Day</h3>
			<div class="weekday-chart">
				{#each [0, 1, 2, 3, 4, 5, 6] as dayNum}
					{@const dayData = stats.weekdayAvg.find((w) => w.day === dayNum)}
					<div class="weekday-col">
						<div class="weekday-bar-container">
							{#if dayData}
								<div
									class="weekday-bar"
									style="height: {(dayData.avgTime / weekdayMaxTime) * 100}%"
									title={`${weekdayNames[dayNum]}: ${formatTime(dayData.avgTime)} avg (${dayData.count} games)`}
								></div>
							{/if}
						</div>
						<span class="weekday-label">{weekdayNames[dayNum].charAt(0)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.personal-stats {
		margin-top: 2rem;
		border-top: 1px solid #444444;
		padding-top: 1.5rem;
	}

	h2 {
		font-size: 1.25rem;
		color: #eeeeee;
		margin: 0 0 1.25rem;
		font-weight: 500;
	}

	h3 {
		font-size: 0.9rem;
		color: #aaaaaa;
		margin: 0 0 0.75rem;
		font-weight: normal;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stats-section {
		margin-bottom: 1.5rem;
	}

	.percentile-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: linear-gradient(135deg, rgba(2, 207, 183, 0.15), rgba(2, 207, 183, 0.05));
		border: 1px solid rgba(2, 207, 183, 0.3);
		border-radius: 12px;
		padding: 1.25rem;
		margin-bottom: 1.5rem;

		.percentile-value {
			font-size: 2rem;
			font-weight: bold;
			color: #02cfb7;
		}

		.percentile-label {
			font-size: 0.85rem;
			color: #cccccc;
			margin-top: 0.25rem;
		}
	}

	.bests-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.best-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		background-color: rgba(255, 255, 255, 0.03);
		border: 1px solid #444444;
		border-radius: 8px;
		padding: 1rem 0.5rem;

		.icon {
			font-size: 1.5rem;
			margin-bottom: 0.25rem;
		}

		.value {
			font-size: 1.35rem;
			font-weight: bold;
			color: #eeeeee;
			font-family: 'Roboto Mono', monospace;
		}

		.label {
			font-size: 0.75rem;
			color: #aaaaaa;
			text-align: center;
			margin-top: 0.25rem;
		}
	}

	.chart-container {
		background-color: rgba(255, 255, 255, 0.02);
		border: 1px solid #444444;
		border-radius: 8px;
		padding: 0.5rem;
	}

	.trend-chart {
		width: 100%;
		height: auto;

		.grid-line {
			stroke: #444444;
			stroke-width: 1;
		}

		.axis-label {
			font-size: 8px;
			fill: #888888;
			font-family: 'Roboto Mono', monospace;
		}

		.trend-line {
			fill: none;
			stroke: #02cfb7;
			stroke-width: 2;
			stroke-linecap: round;
			stroke-linejoin: round;
		}
	}

	.hint-bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.hint-row {
		display: grid;
		grid-template-columns: 5rem 1fr 2.5rem;
		align-items: center;
		gap: 0.75rem;
	}

	.hint-label {
		font-size: 0.85rem;
		color: #bbbbbb;
	}

	.hint-bar-container {
		height: 1.25rem;
		background-color: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
		overflow: hidden;
	}

	.hint-bar {
		height: 100%;
		background-color: #02cfb7;
		border-radius: 4px;
		transition: width 0.3s ease;

		&.one-hint {
			background-color: #f5a623;
		}

		&.two-plus {
			background-color: #ff6f6f;
		}
	}

	.hint-pct {
		font-size: 0.85rem;
		color: #aaaaaa;
		text-align: right;
		font-family: 'Roboto Mono', monospace;
	}

	.weekday-chart {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		height: 80px;
		background-color: rgba(255, 255, 255, 0.02);
		border: 1px solid #444444;
		border-radius: 8px;
		padding: 0.75rem 0.5rem 0.5rem;
	}

	.weekday-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
	}

	.weekday-bar-container {
		flex: 1;
		width: 70%;
		display: flex;
		align-items: flex-end;
	}

	.weekday-bar {
		width: 100%;
		background-color: #02cfb7;
		border-radius: 2px 2px 0 0;
		min-height: 4px;
		transition: height 0.3s ease;
		cursor: default;

		&:hover {
			opacity: 0.8;
		}
	}

	.weekday-label {
		font-size: 0.7rem;
		color: #aaaaaa;
		margin-top: 0.25rem;
	}
</style>
