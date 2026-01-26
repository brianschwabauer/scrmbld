<script lang="ts">
	import { signIn, signUp } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	// Determine redirect URLs based on whether we came from results
	const accountUrl = data.fromResults ? '/account?import=true' : '/account';
	const setupUrl = data.fromResults ? '/account/setup?import=true' : '/account/setup';

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
			goto(accountUrl);
			return;
		}

		// If sign in failed, check if it's because user doesn't exist
		if (
			signInErr?.message?.toLowerCase().includes('user') ||
			signInErr?.message?.toLowerCase().includes('invalid') ||
			signInErr?.message?.toLowerCase().includes('credentials')
		) {
			// Try to create account
			const { data: signUpData, error: signUpErr } = await signUp.email({
				email,
				password,
				name: '',
				callbackURL: '/account/setup',
			});

			if (signUpErr) {
				// Signup failed
				error = signUpErr.message || 'Invalid email or password';
			} else if (signUpData?.user?.emailVerified) {
				// Account created and email already verified
				goto(setupUrl);
				return;
			} else {
				// Account created but email not verified
				goto(`/verify-email?email=${encodeURIComponent(email)}&new=true`);
				return;
			}
		} else {
			error = signInErr?.message || 'An error occurred';
		}

		loading = false;
	}

	async function handleGoogle() {
		await signIn.social({ provider: 'google', callbackURL: accountUrl });
	}
</script>

<div class="container">
	<h1>Sign In</h1>
	<p class="subtitle">or create an account</p>

	<div class="options">
		<button type="button" class="option-btn" onclick={handleGoogle}>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
				<path
					fill="currentColor"
					d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				/>
				<path
					fill="currentColor"
					d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				/>
				<path
					fill="currentColor"
					d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				/>
				<path
					fill="currentColor"
					d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				/>
			</svg>
			Sign in with Google
		</button>

		<a
			href={data.fromResults ? '/signin/magic-link?from=results' : '/signin/magic-link'}
			class="option-btn secondary"
		>
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
		<input type="email" placeholder="Email" bind:value={email} required disabled={loading} />
		<input
			type="password"
			placeholder="Password"
			bind:value={password}
			required
			minlength="8"
			disabled={loading}
		/>
		<small class="hint">Minimum 8 characters</small>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" disabled={loading || !email || password.length < 8}>
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

	.subtitle {
		color: #999999;
		font-size: 1.1rem;
		margin: -0.75rem 0 1rem;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		max-width: 350px;
	}

	.option-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
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
			background-color: rgba(255, 255, 255, 0.1);
			color: #eeeeee;
			border: 1px solid #cccccc;
			box-shadow: 0 4px 0 #999999;

			&:hover {
				border-color: #eeeeee;
			}

			&:active {
				transform: translateY(2px);
				box-shadow: none;
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
				opacity 0.2s,
				background-color 0.2s,
				color 0.2s,
				box-shadow 0.2s;
			box-shadow: 0 4px 0 #999999;
			-webkit-tap-highlight-color: transparent;

			&:disabled {
				background-color: #555555;
				color: #888888;
				box-shadow: 0 4px 0 #333333;
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
		color: #777777;
		font-size: 0.8rem;
		margin-top: -0.5rem;
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
