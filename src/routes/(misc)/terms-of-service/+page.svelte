<script lang="ts">
	import { ripple } from '$lib/ripple';
</script>

<svelte:head>
	<title>Terms of Service | SCRMBLD</title>
</svelte:head>

<div class="container">
	<h1>Terms of Service</h1>
	<p class="updated">Last updated: January 2025</p>

	<section>
		<h2>What is SCRMBLD?</h2>
		<p>
			SCRMBLD is a daily word puzzle game. You can play for free, and optionally create an account
			to save your scores and compete with friends.
		</p>
	</section>

	<section>
		<h2>Your Account</h2>
		<p>
			To create an account, you must provide accurate information. You are responsible for keeping
			your login credentials secure.
		</p>
		<p>You must be at least 13 years old to create an account.</p>
	</section>

	<section>
		<h2>Acceptable Use</h2>
		<p>When using SCRMBLD, you agree not to:</p>
		<ul>
			<li>Use automated tools or bots to play the game</li>
			<li>Attempt to manipulate scores or leaderboards</li>
			<li>Harass other users</li>
			<li>Impersonate others</li>
			<li>Interfere with the service or other users' enjoyment</li>
		</ul>
	</section>

	<section>
		<h2>User Content</h2>
		<p>
			Your username and profile are visible to other users based on your privacy settings. Please
			choose an appropriate username. We may remove accounts with offensive usernames.
		</p>
	</section>

	<section>
		<h2>The Service</h2>
		<p>
			SCRMBLD is provided "as is" without warranties. We do our best to keep the game running, but
			we can't guarantee uninterrupted access.
		</p>
		<p>We may update, modify, or discontinue features at any time.</p>
	</section>

	<section>
		<h2>Termination</h2>
		<p>
			You can delete your account at any time. We may suspend or terminate accounts that violate
			these terms.
		</p>
	</section>

	<section>
		<h2>Limitation of Liability</h2>
		<p>
			SCRMBLD is a free game for entertainment. We are not liable for any damages arising from your
			use of the service. Play responsibly and have fun.
		</p>
	</section>

	<section>
		<h2>Changes to Terms</h2>
		<p>
			We may update these terms occasionally. Continued use of SCRMBLD after changes means you
			accept the new terms.
		</p>
	</section>

	<section>
		<h2>Contact</h2>
		<p>Questions about these terms? Email us at <strong>support@scrmbld.app</strong>.</p>
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
