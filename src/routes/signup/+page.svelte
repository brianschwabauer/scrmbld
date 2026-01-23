<script lang="ts">
	import { signUp, signIn } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let username = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSignUp() {
		if (!email || !password) {
			error = 'Email and password are required';
			return;
		}
		if (username && !/^[a-zA-Z0-9]{6,}$/.test(username)) {
			error = 'Username must be at least 6 alphanumeric characters';
			return;
		}

		loading = true;
		error = '';

		try {
			const { data, error: err } = await signUp.email({
				email,
				password,
				name,
				username: username || undefined,
			});

			if (err) {
				error = err.message || 'Signup failed';
			} else {
				goto('/account');
			}
		} catch (e) {
			error = 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}

	async function handleGoogle() {
		await signIn.social({ provider: 'google', callbackURL: '/account' });
	}
</script>

<div class="auth-container">
	<h1>Create Account</h1>

	<div class="social-auth">
		<button onclick={handleGoogle}>Sign up with Google</button>
	</div>

	<div class="divider">OR</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSignUp();
		}}
	>
		<div class="field">
			<label for="email">Email</label>
			<input type="email" id="email" bind:value={email} required />
		</div>

		<div class="field">
			<label for="password">Password</label>
			<input type="password" id="password" bind:value={password} required />
		</div>

		<div class="field">
			<label for="name">Display Name (Optional)</label>
			<input type="text" id="name" bind:value={name} placeholder="e.g. John Doe" />
		</div>

		<div class="field">
			<label for="username">Username (Optional)</label>
			<input
				type="text"
				id="username"
				bind:value={username}
				placeholder="Unique username (min 6 chars)"
			/>
			<small>Used for friend invites. Must be alphanumeric.</small>
		</div>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" disabled={loading}>
			{loading ? 'Creating Account...' : 'Sign Up'}
		</button>
	</form>

	<p>Already have an account? <a href="/signin">Sign In</a></p>
</div>

<style>
	.auth-container {
		max-width: 400px;
		margin: 2rem auto;
		padding: 1rem;
	}
	.field {
		margin-bottom: 1rem;
	}
	label {
		display: block;
		margin-bottom: 0.5rem;
	}
	input {
		width: 100%;
		padding: 0.5rem;
	}
	.error {
		color: red;
	}
	.divider {
		text-align: center;
		margin: 1rem 0;
	}
	.social-auth button {
		width: 100%;
		padding: 0.5rem;
		background: #eee;
		border: 1px solid #ccc;
	}
</style>
