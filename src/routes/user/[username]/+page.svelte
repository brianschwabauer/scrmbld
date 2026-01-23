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

<div class="profile-container">
	<header>
		<div class="avatar-placeholder">{data.profileUser.username[0].toUpperCase()}</div>
		<div>
			<h1>{data.profileUser.username}</h1>
			{#if data.profileUser.name}
				<p class="name">{data.profileUser.name}</p>
			{/if}
		</div>
	</header>

	<div class="stats-grid">
		<div class="stat-card">
			<h3>Average Time</h3>
			<p class="value">{formatDuration(data.stats.averageTime)}</p>
		</div>
		<div class="stat-card">
			<h3>Wins This Month</h3>
			<p class="value">{data.stats.winsThisMonth}</p>
		</div>
		<div class="stat-card">
			<h3>Total Games</h3>
			<p class="value">{data.stats.history.length}</p>
		</div>
	</div>

	<section class="chart-section">
		<h3>Activity</h3>
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
</div>

<style>
	.profile-container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 1rem;
	}
	header {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-bottom: 2rem;
	}
	.avatar-placeholder {
		width: 64px;
		height: 64px;
		background: #eee;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		font-weight: bold;
	}
	h1 {
		margin: 0;
	}
	.name {
		margin: 0;
		color: #666;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}
	.stat-card {
		background: #f9f9f9;
		padding: 1.5rem;
		border-radius: 8px;
		text-align: center;
	}
	.stat-card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		color: #666;
	}
	.stat-card .value {
		font-size: 2rem;
		font-weight: bold;
		margin: 0;
	}

	.history-grid {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 100px;
		overflow-x: auto;
		padding-bottom: 10px;
	}
	.day-cell {
		width: 10px;
		height: 100px;
		background: transparent;
		display: flex;
		align-items: flex-end;
	}
	.bar {
		width: 100%;
		background: #4caf50;
		border-radius: 2px 2px 0 0;
	}
</style>
