<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let email = $state('');
	let message = $state('');
	let error = $state('');
	let loading = $state(false);
	let sent = $state(false);

	async function handleSubmit() {
		loading = true;
		error = '';
		message = '';

		// @ts-expect-error - forgetPassword exists on better-auth client when emailAndPassword is enabled
		const { error: err } = await authClient.forgetPassword({
			email,
			redirectTo: '/reset-password',
		});

		loading = false;

		if (err) {
			error = err.message || 'Something went wrong. Please try again.';
		} else {
			sent = true;
			message = 'If an account exists with that email, we sent a password reset link.';
		}
	}
</script>

<div class="container">
	<h1>Reset Password</h1>

	{#if sent}
		<div class="success-box">
			<p class="success-message">{message}</p>
			<p class="success-hint">Check your inbox and spam folder. The link expires in 1 hour.</p>
		</div>
		<a href="/signin" class="back-link">Back to Sign In</a>
	{:else}
		<p class="subtitle">We'll email you a link to reset your password</p>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<input
				type="email"
				placeholder="Email"
				bind:value={email}
				required
				disabled={loading}
				autocomplete="email"
			/>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<button type="submit" disabled={loading || !email}>
				{loading ? 'Sending...' : 'Send Reset Link'}
			</button>
		</form>

		<a href="/signin" class="back-link">Back to Sign In</a>
	{/if}
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
		margin: -0.5rem 0 1rem;
		max-width: 300px;
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

	.error {
		color: #ff6f6f;
		font-size: 0.95rem;
		margin: 0;
	}

	.success-box {
		background-color: rgba(2, 207, 183, 0.1);
		border: 1px solid #02cfb7;
		border-radius: 8px;
		padding: 1.25rem;
		max-width: 350px;
		width: 100%;
	}

	.success-message {
		color: #02cfb7;
		font-size: 1rem;
		margin: 0 0 0.5rem;
		font-weight: 500;
	}

	.success-hint {
		color: #999999;
		font-size: 0.85rem;
		margin: 0;
	}

	.back-link {
		font-size: 0.9rem;
		color: #999999;
		margin-top: 0.5rem;

		&:hover {
			color: #eeeeee;
		}
	}
</style>
