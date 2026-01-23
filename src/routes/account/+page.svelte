<script lang="ts">
	import { enhance } from '$app/forms';
	import { signOut } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let { data, form } = $props();

	let privacySettings = $derived(
		data.user?.privacySettings
			? JSON.parse(data.user.privacySettings)
			: { profile: 'public', show_name: false },
	);
</script>

<div class="container">
	<header>
		<h1>Account</h1>
		<button
			type="button"
			class="sign-out"
			onclick={async () => {
				await signOut();
				goto('/');
			}}>Sign Out</button
		>
	</header>

	<section>
		<h2>Profile</h2>
		<form method="POST" action="?/updateProfile" use:enhance>
			<div class="field">
				<label for="username">Username</label>
				<input
					type="text"
					id="username"
					value={data.user.username || ''}
					disabled
					title="Username cannot be changed"
				/>
			</div>
			<div class="field">
				<label for="name">Display Name</label>
				<input type="text" id="name" name="name" value={data.user.name || ''} />
			</div>
			<div class="field">
				<label for="profile">Profile Privacy</label>
				<select id="profile" name="profile" value={privacySettings.profile}>
					<option value="public">Public</option>
					<option value="friends">Friends Only</option>
					<option value="private">Private</option>
				</select>
			</div>
			<div class="field check">
				<label>
					<input type="checkbox" name="showName" checked={privacySettings.show_name} />
					Show Name on Public Profile
				</label>
			</div>
			<button type="submit">Save Changes</button>
		</form>
		{#if form?.success && form?.message === 'Profile updated'}
			<p class="success">Saved!</p>
		{/if}
	</section>

	<section>
		<h2>Game History</h2>
		<p>If you have played anonymously on this device, you can import your history.</p>
		<form method="POST" action="?/claimHistory" use:enhance>
			<button type="submit" class="secondary">Import History from this Device</button>
		</form>
		{#if form?.message && form?.count !== undefined}
			<p class="success">{form.message}</p>
		{/if}
	</section>

	<section>
		<h2>Friends</h2>
		<div class="friends-list">
			{#each data.friends as friend}
				<div class="friend-item">
					<div class="info">
						<strong>{friend.friendUsername}</strong>
						{#if friend.status === 'pending'}
							<span class="badge pending">Pending</span>
						{/if}
					</div>

					<div class="actions">
						{#if friend.status === 'pending' && friend.initiatorId !== data.user.id}
							<form method="POST" action="?/acceptFriend" use:enhance>
								<input type="hidden" name="friendshipId" value={friend.friendshipId} />
								<button type="submit" class="small">Accept</button>
							</form>
						{/if}
						<form method="POST" action="?/removeFriend" use:enhance>
							<input type="hidden" name="friendshipId" value={friend.friendshipId} />
							<button type="submit" class="small danger">Remove</button>
						</form>
					</div>
				</div>
			{:else}
				<p class="empty">No friends yet.</p>
			{/each}
		</div>

		<h3>Add Friend</h3>
		<form method="POST" action="?/sendFriendRequest" use:enhance class="add-friend">
			<input type="text" name="username" placeholder="Username" required />
			<button type="submit">Send Invite</button>
		</form>
		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
	</section>
</div>

<style lang="scss">
	.container {
		display: flex;
		flex-direction: column;
		padding: 2rem 1rem 4rem;
		max-width: 500px;
		margin: 0 auto;
		gap: 1.5rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		line-height: 1;
	}

	h2 {
		font-size: 1.4rem;
		margin: 0 0 1rem;
		color: #eeeeee;
	}

	h3 {
		font-size: 1.1rem;
		margin: 1.5rem 0 0.75rem;
		color: #cccccc;
	}

	.sign-out {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		background-color: transparent;
		color: #999999;
		border: 1px solid #666666;
		border-radius: 4px;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;

		&:hover {
			color: #eeeeee;
			border-color: #999999;
		}
	}

	section {
		padding: 1.25rem;
		border: 1px solid #444444;
		border-radius: 8px;
		background-color: rgba(255, 255, 255, 0.02);
	}

	p {
		color: #bbbbbb;
		font-size: 0.95rem;
		margin: 0 0 1rem;
		line-height: 1.4;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	label {
		font-size: 0.9rem;
		color: #999999;
	}

	input[type='text'],
	select {
		padding: 0.75rem 1rem;
		font-size: 1rem;
		border: 1px solid #555555;
		border-radius: 4px;
		width: 100%;
		box-sizing: border-box;
		background-color: transparent;
		color: #eeeeee;
		outline: none;

		&::placeholder {
			color: #777777;
			opacity: 1;
		}

		&:focus {
			border-color: #888888;
			color: #ffffff;
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	select {
		cursor: pointer;

		option {
			background-color: #333333;
			color: #eeeeee;
		}
	}

	.check label {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		color: #cccccc;
		font-size: 0.95rem;
	}

	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
		cursor: pointer;
	}

	button {
		padding: 0.75rem 1rem;
		font-size: 1rem;
		background-color: #eeeeee;
		color: #333333;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: bold;
		transition:
			transform 0.1s,
			opacity 0.2s;
		box-shadow: 0 4px 0 #999999;
		-webkit-tap-highlight-color: transparent;

		&:hover {
			opacity: 0.9;
		}

		&:active {
			transform: translateY(4px);
			box-shadow: none;
		}

		&.secondary {
			background-color: transparent;
			color: #eeeeee;
			border: 1px solid #666666;
			box-shadow: none;

			&:hover {
				border-color: #999999;
			}

			&:active {
				transform: translateY(2px);
			}
		}

		&.small {
			padding: 0.4rem 0.75rem;
			font-size: 0.85rem;
			box-shadow: 0 3px 0 #999999;

			&:active {
				transform: translateY(3px);
				box-shadow: none;
			}
		}

		&.danger {
			background-color: transparent;
			color: #ff6f6f;
			border: 1px solid #ff6f6f;
			box-shadow: none;

			&:hover {
				background-color: rgba(255, 111, 111, 0.1);
			}

			&:active {
				transform: translateY(2px);
			}
		}
	}

	.friends-list {
		display: flex;
		flex-direction: column;
	}

	.friend-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0;
		border-bottom: 1px solid #333333;

		&:last-child {
			border-bottom: none;
		}

		.info {
			display: flex;
			align-items: center;
			gap: 0.5rem;

			strong {
				color: #eeeeee;
			}
		}

		.actions {
			display: flex;
			gap: 0.5rem;

			form {
				flex-direction: row;
			}
		}
	}

	.badge {
		background-color: #444444;
		color: #bbbbbb;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;

		&.pending {
			background-color: rgba(255, 193, 7, 0.2);
			color: #ffc107;
		}
	}

	.add-friend {
		flex-direction: row;
		gap: 0.75rem;

		input {
			flex: 1;
		}

		button {
			flex-shrink: 0;
		}
	}

	.empty {
		color: #666666;
		font-style: italic;
	}

	.error {
		color: #ff6f6f;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.success {
		color: #02cfb7;
		font-size: 0.9rem;
		margin: 0.75rem 0 0;
	}
</style>
