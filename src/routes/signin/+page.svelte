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

<div class="container">
	<h1>Sign In</h1>

	<div class="social-auth">
		<button type="button" onclick={handleGoogle}>Sign in with Google</button>
	</div>

	<div class="divider">OR</div>

	{#if magicLinkSent}
		<div class="success">
			<p>Check your email ({email}) for a magic link to sign in!</p>
			<button type="button" onclick={() => (magicLinkSent = false)}>Use Password Instead</button>
		</div>
	{:else}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSignIn();
			}}
		>
			<input type="email" placeholder="Email" bind:value={email} required disabled={loading} />
			<input
				type="password"
				placeholder="Password (optional for Magic Link)"
				bind:value={password}
				disabled={loading}
			/>

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
					Magic Link
				</button>
			</div>
		</form>
	{/if}

	<p class="signup-link">Don't have an account? <a href="/signup">Sign Up</a></p>
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

	.success {
		background-color: rgba(2, 207, 183, 0.15);
		border: 1px solid #02cfb7;
		padding: 1.5rem;
		border-radius: 4px;
		width: 100%;
		max-width: 350px;

		p {
			color: #02cfb7;
			margin: 0 0 1rem;
			font-size: 1rem;
		}

		button {
			padding: 0.75rem 1rem;
			font-size: 1rem;
			background-color: transparent;
			color: #eeeeee;
			border: 1px solid #cccccc;
			border-radius: 4px;
			cursor: pointer;
			font-weight: bold;
			transition:
				transform 0.1s,
				opacity 0.2s;
			-webkit-tap-highlight-color: transparent;

			&:hover {
				opacity: 0.9;
				border-color: #eeeeee;
			}

			&:active {
				transform: translateY(2px);
			}
		}
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
	}

	.actions {
		display: flex;
		gap: 1rem;

		button {
			flex: 1;
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

			&.secondary {
				background-color: transparent;
				color: #eeeeee;
				border: 1px solid #cccccc;
				box-shadow: none;

				&:hover:not(:disabled) {
					border-color: #eeeeee;
				}

				&:active:not(:disabled) {
					transform: translateY(2px);
				}
			}
		}
	}

	.error {
		color: #ff6f6f;
		font-size: 1rem;
		margin: 0;
	}

	.signup-link {
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
