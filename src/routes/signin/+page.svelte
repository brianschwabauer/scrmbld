<script lang="ts">
	import { signIn } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');
	let magicLinkSent = $state(false);

	async function handleSignIn() {
		if (!email || !password) {
			error = 'Email and password are required';
			return;
		}

		loading = true;
		error = '';

		try {
			const { data, error: err } = await signIn.email({
				email,
				password,
			});

			if (err) {
				error = err.message || 'Sign in failed';
			} else {
				goto('/account');
			}
		} catch (e) {
			error = 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}

	async function handleMagicLink() {
		if (!email) {
			error = 'Please enter your email to send a magic link';
			return;
		}
		loading = true;
		error = '';
		try {
			const { error: err } = await signIn.magicLink({
				email,
				callbackURL: '/account',
			});
			if (err) {
				error = err.message;
			} else {
				magicLinkSent = true;
				error = '';
			}
		} catch (e) {
			error = 'Failed to send magic link';
		} finally {
			loading = false;
		}
	}

	async function handleGoogle() {
		await signIn.social({ provider: 'google', callbackURL: '/account' });
	}
</script>

<div class="auth-container">
	<h1>Sign In</h1>

	<div class="social-auth">
		<button onclick={handleGoogle}>Sign in with Google</button>
	</div>

	<div class="divider">OR</div>

	{#if magicLinkSent}
		<div class="success">
			<p>Check your email ({email}) for a magic link to sign in!</p>
			<button onclick={() => (magicLinkSent = false)}>Use Password Instead</button>
		</div>
	{:else}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSignIn();
			}}
		>
			<div class="field">
				<label for="email">Email</label>
				<input type="email" id="email" bind:value={email} required />
			</div>

			<div class="field">
				<label for="password">Password</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					placeholder="Optional if using Magic Link"
				/>
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<div class="actions">
				<button type="submit" disabled={loading}>Sign In</button>
				<button
					type="button"
					class="secondary"
					onclick={handleMagicLink}
					disabled={loading || !email}
				>
					Send Magic Link
				</button>
			</div>
		</form>
	{/if}

	<p>Don't have an account? <a href="/signup">Sign Up</a></p>
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
	.success {
		background: #e6f7ff;
		padding: 1rem;
		border-radius: 4px;
		text-align: center;
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
	.actions {
		display: flex;
		gap: 1rem;
	}
	button {
		flex: 1;
		padding: 0.5rem;
	}
	.secondary {
		background: none;
		border: 1px solid #ccc;
	}
</style>
