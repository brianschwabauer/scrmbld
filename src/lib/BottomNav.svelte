<script lang="ts">
	import { page } from '$app/state';

	type Props = {
		userId?: string;
		username?: string;
		todayGameplayId?: string | null;
	};

	let { userId, username, todayGameplayId }: Props = $props();

	const todayHref = $derived(todayGameplayId ? `/results/${todayGameplayId}` : '/play');
	const profileHref = $derived(
		username ? `/user/${username}` : userId ? `/user/${userId}` : '/account',
	);

	const isToday = $derived(
		page.url.pathname.startsWith('/play') || page.url.pathname.startsWith('/results'),
	);
	const isProfile = $derived(page.url.pathname.startsWith('/user/'));
	const isFriends = $derived(page.url.pathname === '/friends');
	const isAccount = $derived(page.url.pathname === '/account');
</script>

<nav class="bottom-nav">
	<a href={todayHref} class:active={isToday}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line
				x1="16"
				x2="16"
				y1="2"
				y2="6"
			/><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
		</svg>
		<span>Today</span>
	</a>
	<a href={profileHref} class:active={isProfile}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />
		</svg>
		<span>Profile</span>
	</a>
	<a href="/friends" class:active={isFriends}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path
				d="M22 21v-2a4 4 0 0 0-3-3.87"
			/><path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
		<span>Friends</span>
	</a>
	<a href="/account" class:active={isAccount}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path
				d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
			/><circle cx="12" cy="12" r="3" />
		</svg>
		<span>Account</span>
	</a>
</nav>

<style lang="scss">
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-around;
		align-items: center;
		background-color: #333333;
		border-top: 1px solid #555555;
		padding: 0.5rem 0;
		padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
		z-index: 100;

		// Desktop: floating vertical nav in top left
		@media (min-width: 768px) {
			top: 1rem;
			left: 1rem;
			bottom: auto;
			right: auto;
			flex-direction: column;
			justify-content: flex-start;
			gap: 0.25rem;
			padding: 0.5rem;
			border-radius: 12px;
			border: 1px solid #444444;
			background-color: rgba(51, 51, 51, 0.95);
			backdrop-filter: blur(10px);
		}
	}

	a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		text-decoration: none;
		color: #888888;
		padding: 0.25rem 0.75rem;
		border-radius: 8px;
		transition:
			color 0.15s,
			background-color 0.15s;
		-webkit-tap-highlight-color: transparent;

		span {
			font-size: 0.7rem;
			font-weight: 500;
		}

		svg {
			width: 22px;
			height: 22px;
		}

		&:hover {
			color: #bbbbbb;

			@media (min-width: 768px) {
				background-color: rgba(255, 255, 255, 0.05);
			}
		}

		&.active {
			color: #02cfb7;
			@media (min-width: 768px) {
				background-color: rgba(255, 255, 255, 0.05);
			}
		}

		// Desktop: slightly larger touch targets
		@media (min-width: 768px) {
			padding: 0.5rem 0.75rem;
			aspect-ratio: 1 / 1;
		}
	}
</style>
