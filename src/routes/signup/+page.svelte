<script lang="ts">
	import { ripple } from '$lib/ripple';

	let email = $state('');
	let name = $state('');
	let errorMessage = $state('');
	let signingUp = $state(false);
	let signedUp = $state(false);

	async function handleSignup() {
		signingUp = true;
		errorMessage = '';
		const response = await fetch('/api/signup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email, name }),
		});
		if (response.ok) {
			email = '';
			name = '';
			signedUp = true;
		} else {
			if (response.status === 400) {
				const data = await response.json<any>();
				errorMessage = data?.message || 'Invalid signup data.';
			} else if (response.status === 409) {
				errorMessage = 'This email is already signed up.';
			} else {
				errorMessage = 'There was an error signing up. Please try again later.';
			}
		}
		signingUp = false;
	}
</script>

<div class="container">
	<h1>Sign Up<br /><small>to Receive Updates</small></h1>

	{#if signedUp}
		<p class="success">Thank you for signing up! We'll keep you updated with the latest news.</p>
	{:else if errorMessage}
		<p class="error">{errorMessage}</p>
	{:else}
		<p>
			Stay informed about about our upcoming card game launch on Kickstarter, new features, and
			special events. We respect your privacy and won't spam you.
		</p>
	{/if}

	<form onsubmit={handleSignup} style:pointer-events={signingUp || signedUp ? 'none' : 'auto'}>
		<input type="email" placeholder="Email" bind:value={email} required disabled={signingUp} />
		<input type="text" placeholder="Name" bind:value={name} disabled={signingUp} />
		<button type="submit" disabled={!email || signingUp || signedUp}>Sign Up</button>
	</form>
	<div class="actions">
		<a href="/" class="button" use:ripple>Back to Game</a>
	</div>
</div>

<style lang="scss">
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem 8rem;
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
		small {
			font-size: 0.8em;
		}
	}

	p {
		font-size: 1.15rem;
		text-wrap: pretty;
		line-height: 1.4;
		margin: 0;
		@media (min-width: 600px) {
			font-size: 1.25rem;
		}
		&.error {
			color: #ff6f6f;
		}
		&.success {
			color: #02cfb7;
		}
	}

	.actions {
		position: fixed;
		bottom: 1.5rem;
		z-index: 10;
	}

	form {
		display: flex;
		flex-direction: column;
		margin: 1.5rem 0 4rem;
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

	.button {
		display: inline-block;
		padding: 1rem 2rem;
		background-color: #eeeeee;
		color: #444444;
		text-decoration: none;
		font-weight: bold;
		border-radius: 4px;
		font-size: 1.5rem;
		transition:
			transform 0.1s,
			opacity 0.2s;
		box-shadow: 0 4px 0 #999999;
		-webkit-tap-highlight-color: transparent;

		&:active {
			transform: translateY(4px);
			box-shadow: none;
		}

		&:hover {
			opacity: 0.9;
		}
	}
</style>
