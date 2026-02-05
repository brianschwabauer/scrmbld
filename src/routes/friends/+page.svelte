<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import BottomNav from '$lib/BottomNav.svelte';

	let { data, form } = $props();

	// Get layout data for bottom nav
	const layoutData = $derived(page.data);

	let showSuccess = $state(false);

	function handleSuccess() {
		showSuccess = true;
		setTimeout(() => {
			showSuccess = false;
		}, 5000);
	}

	function formatTime(ms: number | null): string {
		if (ms === null) return '—';
		const time = Math.round(ms / 1000);
		const minutes = Math.floor(time / 60);
		const seconds = time % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	const hasAcceptedFriends = $derived(data.friends?.some((f) => f.status === 'accepted') ?? false);
</script>

<div class="container">
	<h1>Friends</h1>

	<section class="leaderboard-section">
		<h2>
			Weekly Leaderboard {#if data.weekLabel}<span class="week-label">({data.weekLabel})</span>{/if}
		</h2>
		{#if hasAcceptedFriends && data.leaderboard?.length}
			<div class="leaderboard">
				{#each data.leaderboard as entry, i}
					<a
						href="/user/{entry.username || entry.userId}"
						class="leaderboard-row"
						class:is-self={entry.userId === data.userId}
					>
						<span class="rank">{i + 1}</span>
						<span class="name">
							{#if entry.userId === data.userId}
								You
							{:else if entry.name}
								{entry.name}
							{:else if entry.username}
								@{entry.username}
							{:else}
								Anonymous
							{/if}
						</span>
						<span class="stat avg">{formatTime(entry.avgTime)}</span>
						<span class="stat games">{entry.gamesPlayed}</span>
						<span class="stat streak">
							{#if entry.streak > 0}
								<span class="fire">🔥</span>{entry.streak}
							{:else}
								—
							{/if}
						</span>
					</a>
				{/each}
			</div>
			<div class="leaderboard-legend">
				<span></span>
				<span></span>
				<span>Time</span>
				<span>Games</span>
				<span>Streak</span>
			</div>
		{:else}
			<p class="empty-leaderboard">Add friends to see the weekly leaderboard!</p>
		{/if}
	</section>

	<section class="add-section">
		<h2>Add Friend</h2>
		<form
			method="POST"
			action="?/sendFriendRequest"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update({ reset: true });
					if (result.type === 'success' && result.data?.success) {
						handleSuccess();
					}
				};
			}}
			class="add-friend"
		>
			<input type="text" name="username" placeholder="Enter username" required />
			<button type="submit">Send</button>
		</form>
		{#if showSuccess}
			<p class="success">Friend request sent!</p>
		{:else if form?.error}
			<p class="error">{form.error}</p>
		{/if}
	</section>

	{#if data.friends?.length}
		<div class="friends-list">
			{#each data.friends as friend}
				<a href="/user/{friend.friendUsername || friend.friendId}" class="friend-item">
					<div class="info">
						{#if friend.friendName}
							<strong>{friend.friendName}</strong>
							<span class="username">@{friend.friendUsername}</span>
						{:else}
							<strong>@{friend.friendUsername}</strong>
						{/if}
						{#if friend.status === 'pending'}
							<span class="badge pending">
								{friend.initiatorId === data.userId ? 'Sent' : 'Received'}
							</span>
						{/if}
					</div>

					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="actions" onclick={(e) => e.stopPropagation()}>
						{#if friend.status === 'pending' && friend.initiatorId !== data.userId}
							<form method="POST" action="?/acceptFriend" use:enhance>
								<input type="hidden" name="friendshipId" value={friend.friendshipId} />
								<button type="submit" class="small accept">Accept</button>
							</form>
						{/if}
						<form method="POST" action="?/removeFriend" use:enhance>
							<input type="hidden" name="friendshipId" value={friend.friendshipId} />
							<button
								type="submit"
								class="icon-btn danger"
								aria-label={friend.status === 'pending' ? 'Cancel request' : 'Remove friend'}
								title={friend.status === 'pending' ? 'Cancel request' : 'Remove friend'}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
										d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
									/>
								</svg>
							</button>
						</form>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<p class="empty">No friends yet. Add someone above!</p>
	{/if}
</div>

<BottomNav
	userId={layoutData.session?.user?.id}
	username={layoutData.session?.user?.username}
	todayGameplayId={layoutData.todayGameplayId}
/>

<style lang="scss">
	.container {
		display: flex;
		flex-direction: column;
		padding: 2rem 1rem calc(5rem + env(safe-area-inset-bottom));
		max-width: 500px;
		margin: 0 auto;
		gap: 1rem;

		@media (min-width: 768px) {
			padding: 2rem 1rem 2rem calc(1rem + 70px);
			max-width: calc(500px + 70px);
		}
	}

	h1 {
		font-size: 2rem;
		margin: 0;
		line-height: 1;
	}

	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.75rem;
		color: #bbbbbb;
		font-weight: normal;

		.week-label {
			font-size: 0.9rem;
			color: #888888;
		}
	}

	.leaderboard-section {
		background-color: rgba(255, 255, 255, 0.02);
		border: 1px solid #444444;
		border-radius: 8px;
		padding: 1rem;
	}

	.leaderboard {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.leaderboard-row {
		display: grid;
		grid-template-columns: 2rem 1fr 3.5rem 3rem 3rem;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background-color: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
		font-size: 0.95rem;
		text-decoration: none;
		color: inherit;
		transition: background-color 0.15s;

		&:hover {
			background-color: rgba(255, 255, 255, 0.07);
		}

		&.is-self {
			background-color: rgba(2, 207, 183, 0.12);
			border: 1px solid rgba(2, 207, 183, 0.3);
		}

		.rank {
			font-weight: bold;
			color: #888888;
			text-align: center;
		}

		.name {
			color: #eeeeee;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.stat {
			text-align: right;
			color: #bbbbbb;
			font-family: 'Roboto Mono', monospace;
			font-size: 0.85rem;
		}

		.streak {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			gap: 0.15rem;

			.fire {
				font-size: 0.75rem;
			}
		}
	}

	.leaderboard-legend {
		display: grid;
		grid-template-columns: 2rem 1fr 3.5rem 3rem 3rem;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem 0;
		margin-top: 0.25rem;
		font-size: 0.7rem;
		color: #aaaaaa;
		text-transform: uppercase;
		letter-spacing: 0.5px;

		span {
			text-align: right;
		}
	}

	.empty-leaderboard {
		color: #888888;
		font-size: 0.9rem;
		margin: 0;
		text-align: center;
		padding: 1rem 0;
	}

	.friends-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.friend-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background-color: rgba(255, 255, 255, 0.03);
		border: 1px solid #444444;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s;

		&:hover {
			border-color: #666666;
		}

		.info {
			display: flex;
			flex-direction: column;
			gap: 0.15rem;

			strong {
				color: #eeeeee;
			}

			.username {
				font-size: 0.85rem;
				color: #888888;
			}
		}

		.actions {
			display: flex;
			gap: 0.5rem;
			align-items: center;

			form {
				display: contents;
			}
		}
	}

	.badge {
		display: inline-block;
		background-color: #444444;
		color: #bbbbbb;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		margin-top: 0.25rem;
		width: fit-content;

		&.pending {
			background-color: rgba(255, 255, 255, 0.2);
			color: #cccccc;
		}
	}

	.empty {
		color: #888888;
		font-size: 0.95rem;
		margin: 0;
	}

	.add-section {
		margin-bottom: 1rem;
		border-top: 1px solid #444444;
	}

	.add-friend {
		display: flex;
		gap: 0.75rem;

		input {
			flex: 1;
			padding: 0.75rem 1rem;
			font-size: 1rem;
			border: 1px solid #666666;
			border-radius: 4px;
			background-color: transparent;
			color: #eeeeee;
			outline: none;

			&::placeholder {
				color: #888888;
			}

			&:focus {
				border-color: #888888;
			}
		}

		button {
			padding: 0.75rem 1.25rem;
			font-size: 1rem;
			background-color: #eeeeee;
			color: #333333;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-weight: bold;
			transition:
				transform 0.1s,
				opacity 0.15s;
			box-shadow: 0 3px 0 #999999;
			-webkit-tap-highlight-color: transparent;

			&:hover {
				opacity: 0.9;
			}

			&:active {
				transform: translateY(3px);
				box-shadow: none;
			}
		}
	}

	button.small {
		padding: 0.4rem 0.75rem;
		font-size: 0.85rem;
		background-color: #02cfb7;
		color: #111111;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		box-shadow: 0 2px 0 #008474;
		transition: transform 0.1s;
		-webkit-tap-highlight-color: transparent;

		&:active {
			transform: translateY(2px);
			box-shadow: none;
		}

		&.accept {
			background-color: #00b19c;
			color: white;
		}
	}

	.icon-btn {
		padding: 0.35rem;
		background-color: transparent;
		border: none;
		box-shadow: none;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;

		&:hover {
			background-color: rgba(255, 255, 255, 0.1);
		}

		&:active {
			transform: translateY(1px);
		}

		&.danger {
			background-color: #e85454;
			color: #ffffff;
			box-shadow: 0 2px 0 #b94343;
			transition: transform 0.1s;

			&:hover {
				background-color: #d64a4a;
			}

			&:active {
				transform: translateY(2px);
				box-shadow: none;
			}
		}
	}

	.success {
		color: #02cfb7;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.error {
		color: #ff6f6f;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}
</style>
