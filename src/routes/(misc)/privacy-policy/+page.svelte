<script lang="ts">
	import { ripple } from '$lib/ripple';
</script>

<svelte:head>
	<title>Privacy Policy | SCRMBLD</title>
</svelte:head>

<div class="container">
	<h1>Privacy Policy</h1>
	<p class="updated">Last updated: January 2025</p>

	<section>
		<h2>What We Collect</h2>
		<p>
			When you create an account, we collect your <strong>name</strong> and
			<strong>email address</strong>. If you sign in with Google, we also receive your profile
			picture.
		</p>
		<p>
			When you play the game, we collect basic <strong>gameplay data</strong> like your completion time,
			hints used, and whether you solved the puzzle.
		</p>
		<p>
			We also collect <strong>technical information</strong> like your IP address and browser type to
			help the app work properly and to generate anonymous usage statistics.
		</p>
	</section>

	<section>
		<h2>How We Use Your Data</h2>
		<p>Your data is used to:</p>
		<ul>
			<li>Let you sign in and save your game progress</li>
			<li>Display your profile to friends (based on your privacy settings)</li>
			<li>Show leaderboards and game statistics</li>
			<li>Send account-related emails (verification, password reset)</li>
		</ul>
		<p>
			We do <strong>not</strong> sell your data. We do <strong>not</strong> use your data for
			advertising. We do <strong>not</strong> share your data with third parties for marketing.
		</p>
	</section>

	<section>
		<h2>Friends & Privacy Settings</h2>
		<p>
			You can add other users as friends. You control who sees your profile through your privacy
			settings:
		</p>
		<ul>
			<li><strong>Public</strong> - Anyone can view your profile</li>
			<li><strong>Friends only</strong> - Only accepted friends can view your profile</li>
			<li><strong>Private</strong> - No one can view your profile</li>
		</ul>
	</section>

	<section>
		<h2>Third-Party Services</h2>
		<p>We use the following services to run SCRMBLD:</p>
		<ul>
			<li><strong>Google</strong> - For sign-in (if you choose Google login)</li>
			<li><strong>Resend</strong> - For sending emails</li>
			<li><strong>Cloudflare</strong> - For hosting and infrastructure</li>
		</ul>
	</section>

	<section>
		<h2>Cookies</h2>
		<p>
			We use cookies to keep you signed in and to remember your preferences (like sound settings).
			These are essential cookies required for the app to function.
		</p>
	</section>

	<section>
		<h2>Data Retention</h2>
		<p>
			Your account data is kept as long as you have an account. If you delete your account, your
			data will be removed.
		</p>
	</section>

	<section>
		<h2>Your Rights</h2>
		<p>You can:</p>
		<ul>
			<li>Access your data through your account page</li>
			<li>Update your information at any time</li>
			<li>Delete your account and associated data</li>
			<li>Control your privacy settings</li>
		</ul>
	</section>

	<section>
		<h2>Contact</h2>
		<p>Questions about this policy? Email us at <strong>privacy@scrmbld.app</strong>.</p>
	</section>

	<div class="actions">
		<a href="/" class="button" use:ripple>Back to Game</a>
	</div>
</div>

<style lang="scss">
	.container {
		display: flex;
		flex-direction: column;
		padding: 2rem 1rem calc(6rem + env(safe-area-inset-bottom));
		max-width: 600px;
		margin: 0 auto;
		gap: 1.5rem;

		@media (min-width: 768px) {
			padding: 2rem 1rem 5rem calc(1rem + 70px);
			max-width: calc(600px + 70px);
		}
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		text-transform: uppercase;
		border-bottom: 2px solid #eeeeee;
		padding-bottom: 0.5rem;
	}

	.updated {
		color: #888888;
		font-size: 0.9rem;
		margin: -0.5rem 0 0.5rem;
	}

	section {
		padding: 1.25rem;
		border: 1px solid #444444;
		border-radius: 8px;
		background-color: rgba(255, 255, 255, 0.02);
	}

	h2 {
		font-size: 1.2rem;
		margin: 0 0 0.75rem;
		color: #eeeeee;
	}

	p {
		color: #bbbbbb;
		font-size: 0.95rem;
		line-height: 1.6;
		margin: 0 0 0.75rem;

		&:last-child {
			margin-bottom: 0;
		}
	}

	ul {
		color: #bbbbbb;
		font-size: 0.95rem;
		line-height: 1.6;
		margin: 0;
		padding-left: 1.5rem;
	}

	li {
		margin-bottom: 0.4rem;

		&:last-child {
			margin-bottom: 0;
		}
	}

	strong {
		color: #eeeeee;
		font-weight: 600;
	}

	.actions {
		display: flex;
		justify-content: center;
		position: fixed;
		bottom: calc(1rem + env(safe-area-inset-bottom));
		left: 0;
		width: 100%;
	}

	.button {
		display: inline-block;
		padding: 0.875rem 1.75rem;
		background-color: #eeeeee;
		color: #444444;
		text-decoration: none;
		font-weight: bold;
		border-radius: 4px;
		font-size: 1.25rem;
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
