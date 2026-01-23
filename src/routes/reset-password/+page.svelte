<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let newPassword = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		if (newPassword !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;
		const { error: err } = await authClient.resetPassword({
			newPassword,
		});
		loading = false;

		if (err) {
			error = err.message;
		} else {
			goto('/signin');
		}
	}
</script>

<div class="container">
	<h1>Set New Password</h1>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
	>
		<div class="field">
			<label>New Password</label>
			<input type="password" bind:value={newPassword} required minlength="8" />
		</div>
		<div class="field">
			<label>Confirm Password</label>
			<input type="password" bind:value={confirmPassword} required minlength="8" />
		</div>
		{#if error}
			<p class="error">{error}</p>
		{/if}
		<button disabled={loading}>Reset Password</button>
	</form>
</div>

<style>
	.container {
		max-width: 400px;
		margin: 2rem auto;
		padding: 1rem;
	}
	.field {
		margin: 1rem 0;
	}
	input {
		width: 100%;
		padding: 0.5rem;
	}
	button {
		width: 100%;
		padding: 0.5rem;
	}
	.error {
		color: red;
		margin-bottom: 1rem;
	}
</style>
