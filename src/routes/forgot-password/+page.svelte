<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let email = $state('');
	let message = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		loading = true;
		// @ts-expect-error - forgetPassword exists on better-auth client when emailAndPassword is enabled
		const { error } = await authClient.forgetPassword({
			email,
			redirectTo: '/reset-password',
		});
		loading = false;

		if (error) {
			message = 'Error: ' + error.message;
		} else {
			message = 'If an account exists with that email, we have sent a password reset link.';
		}
	}
</script>

<div class="container">
	<h1>Reset Password</h1>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
	>
		<div class="field">
			<label for="email">Email</label>
			<input id="email" type="email" bind:value={email} required />
		</div>
		<button disabled={loading}>Send Reset Link</button>
	</form>
	{#if message}
		<p class="message">{message}</p>
	{/if}
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
	.message {
		margin-top: 1rem;
		padding: 1rem;
		background: #eee;
	}
</style>
