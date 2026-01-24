<script lang="ts">
	let { data } = $props();

	function formatDuration(ms: number) {
		if (!ms) return 'N/A';
		const s = Math.round(ms / 1000);
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}
</script>

<div class="container">
	<header>
		{#if data.profileUser.name}
			<h1>{data.profileUser.name}</h1>
			<p class="username">@{data.profileUser.username}</p>
		{:else}
			<h1>@{data.profileUser.username}</h1>
		{/if}
	</header>

	<div class="stats-grid">
		<div class="stat-card">
			<span class="label">Average Time</span>
			<span class="value">{formatDuration(data.stats.averageTime)}</span>
		</div>
		<div class="stat-card">
			<span class="label">Wins This Month</span>
			<span class="value">{data.stats.winsThisMonth}</span>
		</div>
		<div class="stat-card">
			<span class="label">Total Games</span>
			<span class="value">{data.stats.history.length}</span>
		</div>
	</div>

	{#if data.stats.history.length > 0}
		<section class="activity-section">
			<h2>Activity</h2>
			<div class="history-grid">
				{#each data.stats.history as game}
					<div class="day-cell" title="Day {game.day}: {formatDuration(Number(game.time))}">
						<div
							class="bar"
							style="height: {Math.min(100, Math.max(10, 100 - (Number(game.time) / 300000) * 100))}%"
						></div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style lang="scss">
	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		margin: 0;
		color: #eeeeee;
		line-height: 1.2;

		@media (min-width: 480px) {
			font-size: 2.5rem;
		}
	}

	.username {
		font-size: 1.1rem;
		color: #888888;
		margin: 0.25rem 0 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		margin-bottom: 2rem;

		@media (min-width: 400px) {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.stat-card {
		background-color: rgba(255, 255, 255, 0.03);
		border: 1px solid #444444;
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;

		.label {
			font-size: 0.8rem;
			color: #888888;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}

		.value {
			font-size: 1.5rem;
			font-weight: bold;
			color: #eeeeee;

			@media (min-width: 400px) {
				font-size: 1.75rem;
			}
		}
	}

	.activity-section {
		h2 {
			font-size: 1.1rem;
			color: #bbbbbb;
			margin: 0 0 1rem;
			font-weight: normal;
		}
	}

	.history-grid {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 80px;
		overflow-x: auto;
		padding-bottom: 0.5rem;
		scrollbar-width: thin;
		scrollbar-color: #444444 transparent;

		&::-webkit-scrollbar {
			height: 6px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background-color: #444444;
			border-radius: 3px;
		}
	}

	.day-cell {
		min-width: 8px;
		width: 8px;
		height: 80px;
		display: flex;
		align-items: flex-end;
		flex-shrink: 0;
	}

	.bar {
		width: 100%;
		background-color: #02cfb7;
		border-radius: 2px 2px 0 0;
		transition: opacity 0.15s;

		&:hover {
			opacity: 0.8;
		}
	}
</style>
