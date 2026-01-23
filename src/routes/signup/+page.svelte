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

<div class="container">
	<h1>Create Account</h1>

	<div class="social-auth">
		<button type="button" onclick={handleGoogle}>Sign up with Google</button>
	</div>

	<div class="divider">OR</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSignUp();
		}}
	>
		<input type="email" placeholder="Email" bind:value={email} required disabled={loading} />
		<input
			type="password"
			placeholder="Password"
			bind:value={password}
			required
			disabled={loading}
		/>
		<input
			type="text"
			placeholder="Display Name (Optional)"
			bind:value={name}
			disabled={loading}
		/>
		<input
			type="text"
			placeholder="Username (Optional)"
			bind:value={username}
			disabled={loading}
		/>
		<small class="hint">Username is used for friend invites. Must be alphanumeric, min 6 chars.</small>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" disabled={loading}>
			{loading ? 'Creating Account...' : 'Sign Up'}
		</button>
	</form>

	<p class="signin-link">Already have an account? <a href="/signin">Sign In</a></p>
</div>

<style lang="scss">
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem 4rem;
		max-width: 500px;
		margin: 0 auto;
		text-align: center;
		gap: 1rem;
		min-height: calc(100svh - 10rem);
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		line-height: 0.9;
	}

	.social-auth {
		width: 100%;
		max-width: 350px;

		button {
			width: 100%;
			padding: 0.75rem 1rem;
			font-size: 1.2rem;
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
		}
	}

	.divider {
		color: #bbbbbb;
		font-size: 0.9rem;
		margin: 0.5rem 0;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
		max-width: 350px;

		input {
			padding: 0.75rem 1rem;
			font-size: 1.2rem;
			border: 1px solid #cccccc;
			border-radius: 4px;
			width: 100%;
			box-sizing: border-box;
			background-color: transparent;
			color: #eeeeee;
			outline: none;

			&::placeholder {
				color: #bbbbbb;
				opacity: 1;
			}

			&:focus {
				border-color: #aaaaaa;
				color: #ffffff;
				box-shadow: none;
			}

			&:disabled {
				opacity: 0.65;
			}
		}

		button {
			padding: 0.75rem 1rem;
			font-size: 1.2rem;
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

			&:disabled {
				opacity: 0.65;
				cursor: not-allowed;
			}

			&:active:not(:disabled) {
				transform: translateY(4px);
				box-shadow: none;
			}

			&:hover:not(:disabled) {
				opacity: 0.9;
			}
		}
	}

	.hint {
		color: #999999;
		font-size: 0.85rem;
		margin-top: -0.5rem;
	}

	.error {
		color: #ff6f6f;
		font-size: 1rem;
		margin: 0;
	}

	.signin-link {
		font-size: 1rem;
		color: #bbbbbb;
		margin-top: 1rem;

		a {
			color: #eeeeee;
			text-decoration: underline;

			&:hover {
				color: #ffffff;
			}
		}
	}
</style>
