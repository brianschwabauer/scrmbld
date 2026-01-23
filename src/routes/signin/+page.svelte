<script lang="ts">
	import { signIn, signUp } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleContinue() {
		if (!email || !password) {
			error = 'Email and password are required';
			return;
		}

		loading = true;
		error = '';

		// First, try to sign in
		const { data: signInData, error: signInErr } = await signIn.email({
			email,
			password,
		});

		if (signInData) {
			// Successful sign in
			goto('/account');
			return;
		}

		// If sign in failed, check if it's because user doesn't exist
		if (signInErr?.message?.toLowerCase().includes('user') ||
			signInErr?.message?.toLowerCase().includes('invalid') ||
			signInErr?.message?.toLowerCase().includes('credentials')) {

			// Try to create account
			const { data: signUpData, error: signUpErr } = await signUp.email({
				email,
				password,
				name: '',
			});

			if (signUpData) {
				// New account created, redirect to setup
				goto('/account/setup');
				return;
			}

			if (signUpErr) {
				// If signup also failed, it's likely invalid credentials for existing user
				error = 'Invalid email or password';
			}
		} else {
			error = signInErr?.message || 'An error occurred';
		}

		loading = false;
	}

	async function handleGoogle() {
		await signIn.social({ provider: 'google', callbackURL: '/account' });
	}
</script>

<div class="container">
	<h1>Sign In</h1>

	<div class="options">
		<button type="button" class="option-btn" onclick={handleGoogle}>
			Sign in with Google
		</button>

		<a href="/signin/magic-link" class="option-btn secondary">
			Email me a login link
		</a>
	</div>

	<div class="divider">
		<span>or use email</span>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleContinue();
		}}
	>
		<input
			type="email"
			placeholder="Email"
			bind:value={email}
			required
			disabled={loading}
		/>
		<input
			type="password"
			placeholder="Password"
			bind:value={password}
			required
			disabled={loading}
		/>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" disabled={loading}>
			{loading ? 'Please wait...' : 'Continue'}
		</button>
	</form>

	<a href="/forgot-password" class="forgot-link">Forgot password?</a>
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

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		max-width: 350px;
	}

	.option-btn {
		display: block;
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 1.1rem;
		background-color: #eeeeee;
		color: #333333;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: bold;
		text-decoration: none;
		text-align: center;
		box-sizing: border-box;
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
			border: 1px solid #cccccc;
			box-shadow: none;

			&:hover {
				border-color: #eeeeee;
			}

			&:active {
				transform: translateY(2px);
			}
		}
	}

	.divider {
		display: flex;
		align-items: center;
		width: 100%;
		max-width: 350px;
		margin: 0.5rem 0;

		&::before,
		&::after {
			content: '';
			flex: 1;
			height: 1px;
			background-color: #555555;
		}

		span {
			padding: 0 1rem;
			color: #999999;
			font-size: 0.85rem;
		}
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 350px;

		input {
			padding: 0.75rem 1rem;
			font-size: 1.1rem;
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
			font-size: 1.1rem;
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

	.error {
		color: #ff6f6f;
		font-size: 0.95rem;
		margin: 0;
	}

	.forgot-link {
		font-size: 0.9rem;
		color: #999999;
		margin-top: 0.5rem;

		&:hover {
			color: #eeeeee;
		}
	}
</style>
