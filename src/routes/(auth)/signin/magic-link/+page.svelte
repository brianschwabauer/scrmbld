<script lang="ts">
	import { signIn } from '$lib/auth-client';

	const { data } = $props();

	let email = $state('');
	let loading = $state(false);
	let error = $state('');
	let sent = $state(false);

	// Use import param in callback if coming from results
	const callbackURL = data.fromResults ? '/account/setup?import=true' : '/account/setup';

	async function handleSendLink() {
		if (!email) {
			error = 'Please enter your email';
			return;
		}

		loading = true;
		error = '';

		try {
			const { error: err } = await signIn.magicLink({
				email,
				callbackURL,
			});

			if (err) {
				error = err.message || 'Failed to send link';
			} else {
				sent = true;
			}
		} catch (e) {
			error = 'An error occurred. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="container">
	{#if sent}
		<h1>Check your email</h1>
		<p class="success">
			We sent a sign-in link to <strong>{email}</strong>
		</p>
		<p class="hint">Click the link in your email to sign in. You can close this page.</p>
		<button
			type="button"
			class="secondary"
			onclick={() => {
				sent = false;
				email = '';
			}}
		>
			Use a different email
		</button>
	{:else}
		<a href={data.fromResults ? '/signin?from=results' : '/signin'} class="back-link">&larr; Back</a
		>

		<h1>Login link</h1>
		<p>Enter your email and we'll send you a link to sign in. No password needed.</p>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSendLink();
			}}
		>
			<input type="email" placeholder="Email" bind:value={email} required disabled={loading} />

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<button type="submit" disabled={loading || !email}>
				{loading ? 'Sending...' : 'Send link to my email'}
			</button>
		</form>
	{/if}
</div>

<style lang="scss">
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem 4rem;
		max-width: 400px;
		margin: 0 auto;
		text-align: center;
		gap: 1rem;
		min-height: calc(100svh - 10rem);
	}

	.back-link {
		align-self: flex-start;
		color: #999999;
		text-decoration: none;
		font-size: 0.95rem;
		margin-bottom: 0.5rem;

		&:hover {
			color: #eeeeee;
		}
	}

	h1 {
		font-size: 2rem;
		margin: 0;
		line-height: 1;
	}

	p {
		font-size: 1rem;
		color: #bbbbbb;
		margin: 0;
		max-width: 380px;
		line-height: 1.4;
		text-wrap: pretty;

		&.success {
			color: #02cfb7;
			font-size: 1.1rem;
		}

		&.hint {
			font-size: 0.9rem;
			color: #888888;
		}

		strong {
			color: #eeeeee;
		}
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 380px;
		margin-top: 0.5rem;

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

	button.secondary {
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
		margin-top: 1rem;

		&:hover {
			border-color: #eeeeee;
		}

		&:active {
			transform: translateY(2px);
		}
	}

	.error {
		color: #ff6f6f;
		font-size: 0.95rem;
		margin: 0;
	}
</style>
