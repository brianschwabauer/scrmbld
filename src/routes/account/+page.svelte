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

<div class="account-container">
	<header>
		<h1>Account Settings</h1>
		<button
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
				<label>Username</label>
				<input
					type="text"
					value={data.user.username || ''}
					disabled
					title="Username cannot be changed"
				/>
			</div>
			<div class="field">
				<label>Display Name</label>
				<input type="text" name="name" value={data.user.name || ''} />
			</div>
			<div class="field">
				<label>Profile Privacy</label>
				<select name="profile" value={privacySettings.profile}>
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
			<button>Save Preference</button>
		</form>
		{#if form?.success && form?.message === 'Profile updated'}
			<p class="success">Saved!</p>
		{/if}
	</section>

	<section>
		<h2>Game History</h2>
		<p>If you have played anonymously on this device, you can import your history.</p>
		<form method="POST" action="?/claimHistory" use:enhance>
			<button>Import History from this Device</button>
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
								<button class="small">Accept</button>
							</form>
						{/if}
						<form method="POST" action="?/removeFriend" use:enhance>
							<input type="hidden" name="friendshipId" value={friend.friendshipId} />
							<button class="small danger">Remove</button>
						</form>
					</div>
				</div>
			{:else}
				<p>No friends yet.</p>
			{/each}
		</div>

		<h3>Add Friend</h3>
		<form method="POST" action="?/sendFriendRequest" use:enhance class="add-friend">
			<input type="text" name="username" placeholder="Username" required />
			<button>Send Invite</button>
		</form>
		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
	</section>
</div>

<style>
	.account-container {
		max-width: 600px;
		margin: 2rem auto;
		padding: 1rem;
	}
	section {
		margin-bottom: 2rem;
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 8px;
	}
	h2 {
		margin-top: 0;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}
	.field {
		margin-bottom: 1rem;
	}
	label {
		display: block;
		margin-bottom: 0.5rem;
	}
	input[type='text'],
	select {
		width: 100%;
		padding: 0.5rem;
	}
	.check label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.friend-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid #eee;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
	.small {
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
	}
	.danger {
		background: #fee;
		color: red;
		border-color: red;
	}
	.add-friend {
		display: flex;
		gap: 0.5rem;
	}
	.error {
		color: red;
	}
	.success {
		color: green;
	}
	.badge {
		background: #eee;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.8rem;
		margin-left: 0.5rem;
	}
</style>
