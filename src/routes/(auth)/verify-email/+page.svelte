<script lang="ts">
	import { enhance } from '$app/forms';
	import { signOut, sendVerificationEmail } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let { data, form } = $props();

	let loading = $state(false);
	let showSuccess = $state(false);
	let hasResent = $state(false);
	let clientError = $state('');

	function handleSignOut() {
		signOut().then(() => {
			goto('/');
		});
	}

	async function handleClientResend() {
		if (hasResent || !data.email) return;

		loading = true;
		clientError = '';

		try {
			await sendVerificationEmail({
				email: data.email,
				callbackURL: '/account/setup',
			});
			showSuccess = true;
			hasResent = true;
		} catch (e: any) {
			clientError = e?.message || 'Failed to send verification email';
		} finally {
			loading = false;
		}
	}
</script>

<div class="container">
	<div class="card">
		<div class="icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect width="20" height="16" x="2" y="4" rx="2" />
				<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
			</svg>
		</div>

		{#if data.isNewSignup}
			<h1>Account Created!</h1>
			<p class="description">
				We've sent a verification link to <strong>{data.email}</strong>. Please check your inbox
				and click the link to complete your account setup.
			</p>
		{:else}
			<h1>Verify Your Email</h1>
			<p class="description">
				We've sent a verification link to <strong>{data.email}</strong>. Please check your inbox
				and click the link to verify your email address.
			</p>
		{/if}

		<p class="hint">
			Can't find it? Check your spam folder or request a new verification email below.
		</p>

		{#if data.hasSession}
			<!-- Use server action when we have a session -->
			<form
				method="POST"
				action="?/resendVerification"
				use:enhance={() => {
					loading = true;
					showSuccess = false;
					return async ({ result, update }) => {
						loading = false;
						if (result.type === 'success' && result.data?.success) {
							showSuccess = true;
							hasResent = true;
						}
						await update({ reset: false });
					};
				}}
			>
				<button type="submit" class="primary" disabled={loading || hasResent}>
					{#if hasResent}
						Email Sent
					{:else if loading}
						Sending...
					{:else}
						Resend Verification Email
					{/if}
				</button>
			</form>
		{:else}
			<!-- Use client-side API when no session -->
			<button
				type="button"
				class="primary"
				disabled={loading || hasResent}
				onclick={handleClientResend}
			>
				{#if hasResent}
					Email Sent
				{:else if loading}
					Sending...
				{:else}
					Resend Verification Email
				{/if}
			</button>
		{/if}

		{#if showSuccess}
			<p class="success">Verification email sent! Check your inbox.</p>
		{:else if clientError}
			<p class="error">{clientError}</p>
		{:else if form?.error}
			<p class="error">{form.error}</p>
		{/if}

		{#if hasResent}
			<p class="resent-hint">Refresh the page to send another email.</p>
		{/if}

		{#if data.hasSession}
			<div class="divider"></div>
			<p class="secondary-text">Wrong email or need to start over?</p>
			<button type="button" class="secondary" onclick={handleSignOut}>Sign Out</button>
		{:else}
			<div class="divider"></div>
			<p class="secondary-text">Need to use a different email?</p>
			<a href="/signin" class="secondary-link">Back to Sign In</a>
		{/if}
	</div>
</div>

<style lang="scss">
	.container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.card {
		max-width: 420px;
		width: 100%;
		background-color: rgba(255, 255, 255, 0.03);
		border: 1px solid #444444;
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
	}

	.icon {
		color: #02cfb7;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: 1.5rem;
		margin: 0 0 1rem;
		color: #eeeeee;
	}

	.description {
		color: #bbbbbb;
		line-height: 1.5;
		margin: 0 0 0.75rem;

		strong {
			color: #eeeeee;
		}
	}

	.hint {
		color: #888888;
		font-size: 0.9rem;
		margin: 0 0 1.5rem;
	}

	button {
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 1rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
		transition:
			transform 0.1s,
			opacity 0.15s;
		-webkit-tap-highlight-color: transparent;

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		&.primary {
			background-color: #eeeeee;
			color: #333333;
			box-shadow: 0 3px 0 #999999;

			&:hover:not(:disabled) {
				opacity: 0.9;
			}

			&:active:not(:disabled) {
				transform: translateY(3px);
				box-shadow: none;
			}
		}

		&.secondary {
			background-color: transparent;
			color: #888888;
			border: 1px solid #555555;

			&:hover {
				color: #bbbbbb;
				border-color: #666666;
			}

			&:active {
				transform: translateY(2px);
			}
		}
	}

	.success {
		color: #02cfb7;
		font-size: 0.9rem;
		margin: 1rem 0 0;
	}

	.error {
		color: #ff6f6f;
		font-size: 0.9rem;
		margin: 1rem 0 0;
	}

	.resent-hint {
		color: #666666;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
		font-style: italic;
	}

	.divider {
		height: 1px;
		background-color: #444444;
		margin: 1.5rem 0;
	}

	.secondary-text {
		color: #888888;
		font-size: 0.9rem;
		margin: 0 0 0.75rem;
	}

	.secondary-link {
		display: block;
		color: #888888;
		font-size: 0.95rem;
		text-decoration: none;
		padding: 0.5rem;

		&:hover {
			color: #bbbbbb;
		}
	}
</style>
