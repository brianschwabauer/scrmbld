<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import BottomNav from '$lib/BottomNav.svelte';
	import Expand from '$lib/Expand.svelte';
	import PersonalStats from '$lib/PersonalStats.svelte';
	import { ACHIEVEMENT_MAP } from '$lib/achievements';

	let { data, form } = $props();

	// Get layout data for bottom nav
	const layoutData = $derived(page.data);

	let loading = $state(false);
	let selectedAchievement = $state<string | null>(null);

	function formatDuration(ms: number) {
		if (!ms) return 'N/A';
		const s = Math.round(ms / 1000);
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}
</script>

<div class="container" class:has-nav={layoutData.session}>
	<header>
		{#if data.profileUser.name}
			<h1>{data.profileUser.name}</h1>
			{#if data.profileUser.username}
				<p class="username">@{data.profileUser.username}</p>
			{/if}
		{:else}
			<h1>@{data.profileUser.username}</h1>
		{/if}

		{#if data.isSignedIn && !data.profileUser.isSelf}
			<div class="friend-action">
				{#if data.friendshipStatus === 'none'}
					<form
						method="POST"
						action="?/addFriend"
						use:enhance={() => {
							loading = true;
							return async ({ update }) => {
								loading = false;
								await update();
							};
						}}
					>
						<button type="submit" class="friend-btn" disabled={loading}>
							{loading ? 'Sending...' : 'Add Friend'}
						</button>
					</form>
				{:else if data.friendshipStatus === 'pending_sent'}
					<form
						method="POST"
						action="?/cancelRequest"
						use:enhance={() => {
							loading = true;
							return async ({ update }) => {
								loading = false;
								await update();
							};
						}}
					>
						<input type="hidden" name="friendshipId" value={data.friendshipId} />
						<button type="submit" class="friend-btn pending" disabled={loading}>
							{loading ? 'Canceling...' : 'Pending Friend Request'}
						</button>
					</form>
				{:else if data.friendshipStatus === 'pending_received'}
					<form
						method="POST"
						action="?/acceptFriend"
						use:enhance={() => {
							loading = true;
							return async ({ update }) => {
								loading = false;
								await update();
							};
						}}
					>
						<input type="hidden" name="friendshipId" value={data.friendshipId} />
						<button type="submit" class="friend-btn accept" disabled={loading}>
							{loading ? 'Accepting...' : 'Accept Friend Request'}
						</button>
					</form>
				{:else if data.friendshipStatus === 'accepted'}
					<span class="friend-badge">Friends</span>
				{/if}

				{#if form?.error}
					<p class="error">{form.error}</p>
				{/if}
			</div>
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
				{#each data.stats.history as game, i}
					<div
						class="day-cell"
						title="{new Date(game.day).toLocaleDateString()}: {formatDuration(Number(game.time))}"
					>
						<div
							class="bar"
							style="height: {Math.min(
								100,
								Math.max(10, 100 - (Number(game.time) / 300000) * 100),
							)}%; animation-delay: {i * 15}ms"
						></div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.achievements && data.achievements.length > 0}
		<section class="achievements-section">
			<h2>Achievements</h2>
			<div class="achievements-grid">
				{#each data.achievements as ach}
					{@const def = ACHIEVEMENT_MAP[ach.achievementId]}
					{#if def}
						<button
							class="achievement-badge"
							class:selected={selectedAchievement === ach.achievementId}
							onclick={() =>
								(selectedAchievement =
									selectedAchievement === ach.achievementId ? null : ach.achievementId)}
						>
							<span class="icon">{def.icon}</span>
							<span class="name">{def.name}</span>
						</button>
					{/if}
				{/each}
			</div>
			<Expand show={selectedAchievement !== null && !!ACHIEVEMENT_MAP[selectedAchievement ?? '']}>
				<div>
					<p class="achievement-description">
						{ACHIEVEMENT_MAP[selectedAchievement ?? '']?.description}
					</p>
				</div>
			</Expand>
		</section>
	{/if}

	{#if data.profileUser.isSelf && data.personalStats}
		<PersonalStats stats={data.personalStats} />
	{/if}
</div>

{#if layoutData.session}
	<BottomNav
		userId={layoutData.session?.user?.id}
		username={layoutData.session?.user?.username}
		todayGameplayId={layoutData.todayGameplayId}
	/>
{/if}

<style lang="scss">
	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;

		&.has-nav {
			padding-bottom: calc(5rem + env(safe-area-inset-bottom));

			@media (min-width: 768px) {
				padding: 2rem 1rem 4rem calc(1rem + 100px);
				max-width: 650px;
			}
		}
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
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
		margin: 0;
	}

	.friend-action {
		margin-top: 1rem;

		form {
			display: contents;
		}
	}

	.friend-btn {
		padding: 0.5rem 1.25rem;
		font-size: 0.95rem;
		background-color: #02cfb7;
		color: #111111;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		transition:
			transform 0.1s,
			opacity 0.15s;
		box-shadow: 0 3px 0 #019a87;
		-webkit-tap-highlight-color: transparent;

		&:hover:not(:disabled) {
			opacity: 0.9;
		}

		&:active:not(:disabled) {
			transform: translateY(3px);
			box-shadow: none;
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		&.pending {
			background-color: transparent;
			color: #888888;
			border: 1px solid #555555;
			box-shadow: none;

			&:hover:not(:disabled) {
				border-color: #ff6f6f;
				color: #ff6f6f;
			}

			&:active:not(:disabled) {
				transform: translateY(2px);
			}
		}

		&.accept {
			background-color: #02cfb7;
			box-shadow: 0 3px 0 #019a87;
		}
	}

	.friend-badge {
		display: inline-block;
		padding: 0.5rem 1.25rem;
		font-size: 0.95rem;
		background-color: rgba(2, 207, 183, 0.15);
		color: #02cfb7;
		border: 1px solid #02cfb7;
		border-radius: 4px;
		font-weight: 500;
	}

	.error {
		color: #ff6f6f;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
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
			color: #aaaaaa;
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
			font-size: 1.25rem;
			color: #eeeeee;
			margin: 0 0 1rem;
			font-weight: 500;
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

		&::after {
			content: '';
			flex: 1;
			align-self: stretch;
			background: repeating-linear-gradient(
				to right,
				rgba(255, 255, 255, 0.05) 0,
				rgba(255, 255, 255, 0.05) 8px,
				transparent 8px,
				transparent 10px
			);
			border-radius: 2px;
			min-width: 10px;
		}

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
		animation: bar-grow 0.3s ease-out backwards;
		transform-origin: bottom;

		&:hover {
			opacity: 0.8;
		}
	}

	@keyframes bar-grow {
		from {
			transform: scaleY(0);
		}
		to {
			transform: scaleY(1);
		}
	}

	.achievements-section {
		margin-top: 2rem;

		h2 {
			font-size: 1.25rem;
			color: #eeeeee;
			margin: 0 0 1rem;
			font-weight: 500;
		}
	}

	.achievements-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.achievement-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.75rem 0.5rem;
		background-color: rgba(255, 255, 255, 0.03);
		border: 1px solid #444444;
		border-radius: 8px;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background-color 0.15s;
		font-family: inherit;
		font-size: inherit;
		-webkit-tap-highlight-color: transparent;

		&:hover {
			border-color: #02cfb7;
		}

		&.selected {
			border-color: #02cfb7;
			background-color: rgba(2, 207, 183, 0.1);
		}

		.icon {
			font-size: 1.5rem;
		}

		.name {
			font-size: 0.75rem;
			color: #bbbbbb;
			text-align: center;
		}
	}

	.achievement-description {
		margin: 0.75rem 0 0;
		padding: 0.75rem 1rem;
		font-size: 0.9rem;
		color: #cccccc;
		text-align: center;
		background: linear-gradient(135deg, rgba(2, 207, 183, 0.15), rgba(2, 207, 183, 0.05));
		border: 1px solid rgba(2, 207, 183, 0.3);
		border-radius: 12px;
	}
</style>
