<script lang="ts">
	import { enhance } from '$app/forms';
	import { signIn, signOut } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import BottomNav from '$lib/BottomNav.svelte';

	let { data, form } = $props();

	// Get layout data for bottom nav
	const layoutData = $derived(page.data);

	// Derived account info
	let hasGoogle = $derived(
		data.linkedAccounts?.some((a: { providerId: string }) => a.providerId === 'google'),
	);
	let hasPassword = $derived(
		data.linkedAccounts?.some((a: { providerId: string }) => a.providerId === 'credential'),
	);
	let canRemoveMethod = $derived((data.linkedAccounts?.length ?? 0) > 1);

	// Security section state
	let showChangePassword = $state(false);
	let showSetPassword = $state(false);
	let showChangeEmail = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let newEmail = $state('');
	let securityLoading = $state(false);
	let securityError = $state('');
	let securitySuccess = $state('');

	function clearSecurityForms() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		newEmail = '';
		securityError = '';
	}

	async function linkGoogle() {
		await signIn.social({
			provider: 'google',
			callbackURL: '/account',
			newUserCallbackURL: '/account/setup',
		});
	}

	let privacySettings = $derived(
		data.user?.privacySettings ? JSON.parse(data.user.privacySettings) : { profile: 'public' },
	);

	// Track original values to detect changes
	let originalUsername = $state(data.user?.username || '');
	let originalName = $state(data.user?.name || '');
	let originalProfile = $state(privacySettings.profile);

	// Track form field values
	let username = $state(data.user?.username || '');
	let name = $state(data.user?.name || '');
	let profile = $state(privacySettings.profile);

	// Check if any field has changed from original
	let hasChanges = $derived(
		username !== originalUsername || name !== originalName || profile !== originalProfile,
	);

	// Sync originals after successful save
	function syncAfterSave() {
		originalUsername = username;
		originalName = name;
		originalProfile = profile;
	}

	// Track which section had the last action for showing feedback
	let lastAction = $state<'profile' | 'history' | 'security' | null>(null);

	// Auto-hide success messages after 5 seconds
	let showProfileSuccess = $state(false);
	let showHistorySuccess = $state(false);
	let historyMessage = $state('');

	// Auto-import success banner
	let showAutoImportBanner = $state((data.autoImportCount ?? 0) > 0);

	$effect(() => {
		if ((data.autoImportCount ?? 0) > 0) {
			setTimeout(() => {
				showAutoImportBanner = false;
			}, 8000);
		}
	});

	function showSuccessFor(section: 'profile' | 'history') {
		if (section === 'profile') showProfileSuccess = true;
		else if (section === 'history') showHistorySuccess = true;

		setTimeout(() => {
			if (section === 'profile') showProfileSuccess = false;
			else if (section === 'history') showHistorySuccess = false;
		}, 5000);
	}
</script>

<div class="container">
	{#if showAutoImportBanner}
		<div class="import-banner">
			Successfully imported {data.autoImportCount} game{data.autoImportCount === 1 ? '' : 's'} to your
			account!
		</div>
	{/if}

	<header>
		<div class="title">
			<h1>Account</h1>
			{#if data.user?.email}
				<p class="email">{data.user.email}</p>
			{/if}
		</div>
		<button
			type="button"
			class="sign-out"
			onclick={async () => {
				await signOut();
				goto('/');
			}}>Sign Out</button
		>
	</header>

	<section>
		<h2>Profile</h2>
		<form
			method="POST"
			action="?/updateProfile"
			use:enhance={() => {
				lastAction = 'profile';
				return async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success' && result.data?.success) {
						syncAfterSave();
						showSuccessFor('profile');
					}
				};
			}}
		>
			<div class="field">
				<label for="username">Username</label>
				<input
					type="text"
					id="username"
					name="username"
					bind:value={username}
					placeholder="Choose a username"
				/>
				<small class="hint">Min 6 alphanumeric characters. Used for friend invites.</small>
			</div>
			<div class="field">
				<label for="name">Display Name</label>
				<input type="text" id="name" name="name" bind:value={name} />
			</div>
			<div class="field">
				<label for="profile">Profile Privacy</label>
				<select id="profile" name="profile" bind:value={profile}>
					<option value="public" selected={privacySettings.profile === 'public'}>Public</option>
					<option value="friends" selected={privacySettings.profile === 'friends'}
						>Friends Only</option
					>
					<option value="private" selected={privacySettings.profile === 'private'}>Private</option>
				</select>
			</div>
			<button type="submit" disabled={!hasChanges}>Save Changes</button>
		</form>
		{#if showProfileSuccess}
			<p class="success">Saved!</p>
		{:else if form?.error && lastAction === 'profile'}
			<p class="error">{form.error}</p>
		{/if}
	</section>

	<section>
		<h2>Security</h2>

		<div class="security-subsection">
			<h3>Sign-in Methods</h3>
			<div class="signin-methods">
				<div class="method">
					<div class="method-info">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect width="20" height="16" x="2" y="4" rx="2" /><path
								d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
							/>
						</svg>
						<span>Email & Password</span>
					</div>
					{#if hasPassword}
						<div class="method-status">
							<span class="badge connected">Connected</span>
							{#if canRemoveMethod}
								<form
									method="POST"
									action="?/unlinkAccount"
									use:enhance={() => {
										lastAction = 'security';
										return async ({ result, update }) => {
											await update({ reset: false });
										};
									}}
								>
									<input type="hidden" name="providerId" value="credential" />
									<button
										type="submit"
										class="icon-btn danger"
										title="Remove sign-in method"
										aria-label="Remove sign-in method"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M18 6 6 18" /><path d="m6 6 12 12" />
										</svg>
									</button>
								</form>
							{/if}
						</div>
					{:else}
						<button
							type="button"
							class="small"
							onclick={() => {
								showSetPassword = true;
								clearSecurityForms();
							}}
						>
							Add Password
						</button>
					{/if}
				</div>

				<div class="method">
					<div class="method-info">
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
						<span>Google</span>
					</div>
					{#if hasGoogle}
						<div class="method-status">
							<span class="badge connected">Connected</span>
							{#if canRemoveMethod}
								<form
									method="POST"
									action="?/unlinkAccount"
									use:enhance={() => {
										lastAction = 'security';
										return async ({ result, update }) => {
											await update({ reset: false });
										};
									}}
								>
									<input type="hidden" name="providerId" value="google" />
									<button
										type="submit"
										class="icon-btn danger"
										title="Remove sign-in method"
										aria-label="Remove sign-in method"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M18 6 6 18" /><path d="m6 6 12 12" />
										</svg>
									</button>
								</form>
							{/if}
						</div>
					{:else}
						<button type="button" class="small" onclick={linkGoogle}> Connect </button>
					{/if}
				</div>
			</div>
		</div>

		{#if hasPassword}
			<div class="security-subsection">
				<h3>Password</h3>
				{#if showChangePassword}
					<form
						method="POST"
						action="?/changePassword"
						use:enhance={() => {
							securityLoading = true;
							securityError = '';
							lastAction = 'security';
							return async ({ result, update }) => {
								securityLoading = false;
								if (result.type === 'success' && result.data?.success) {
									securitySuccess = 'Password changed successfully';
									showChangePassword = false;
									clearSecurityForms();
									setTimeout(() => (securitySuccess = ''), 5000);
								}
								await update({ reset: false });
							};
						}}
					>
						<input
							type="password"
							name="currentPassword"
							placeholder="Current password"
							bind:value={currentPassword}
							required
							disabled={securityLoading}
						/>
						<input
							type="password"
							name="newPassword"
							placeholder="New password"
							bind:value={newPassword}
							required
							minlength="8"
							disabled={securityLoading}
						/>
						<input
							type="password"
							name="confirmPassword"
							placeholder="Confirm new password"
							bind:value={confirmPassword}
							required
							minlength="8"
							disabled={securityLoading}
						/>
						<div class="form-actions">
							<button
								type="submit"
								disabled={securityLoading ||
									!currentPassword ||
									newPassword.length < 8 ||
									newPassword !== confirmPassword}
							>
								{securityLoading ? 'Saving...' : 'Change Password'}
							</button>
							<button
								type="button"
								class="secondary"
								onclick={() => {
									showChangePassword = false;
									clearSecurityForms();
								}}
							>
								Cancel
							</button>
						</div>
					</form>
				{:else}
					<button
						type="button"
						class="secondary"
						onclick={() => {
							showChangePassword = true;
							clearSecurityForms();
						}}
					>
						Change Password
					</button>
				{/if}
			</div>
		{:else if showSetPassword}
			<div class="security-subsection">
				<h3>Set Password</h3>
				<p class="hint">Add a password to sign in with email and password.</p>
				<form
					method="POST"
					action="?/setPassword"
					use:enhance={() => {
						securityLoading = true;
						securityError = '';
						lastAction = 'security';
						return async ({ result, update }) => {
							securityLoading = false;
							if (result.type === 'success' && result.data?.success) {
								securitySuccess = 'Password set successfully';
								showSetPassword = false;
								clearSecurityForms();
								setTimeout(() => (securitySuccess = ''), 5000);
							}
							await update({ reset: false });
						};
					}}
				>
					<input
						type="password"
						name="newPassword"
						placeholder="New password"
						bind:value={newPassword}
						required
						minlength="8"
						disabled={securityLoading}
					/>
					<input
						type="password"
						name="confirmPassword"
						placeholder="Confirm password"
						bind:value={confirmPassword}
						required
						minlength="8"
						disabled={securityLoading}
					/>
					<div class="form-actions">
						<button
							type="submit"
							disabled={securityLoading ||
								newPassword.length < 8 ||
								newPassword !== confirmPassword}
						>
							{securityLoading ? 'Saving...' : 'Set Password'}
						</button>
						<button
							type="button"
							class="secondary"
							onclick={() => {
								showSetPassword = false;
								clearSecurityForms();
							}}
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		{/if}

		<div class="security-subsection">
			<h3>Email</h3>
			<p class="current-value">{data.user?.email}</p>
			{#if showChangeEmail}
				<form
					method="POST"
					action="?/changeEmail"
					use:enhance={() => {
						securityLoading = true;
						securityError = '';
						lastAction = 'security';
						return async ({ result, update }) => {
							securityLoading = false;
							if (result.type === 'success' && result.data?.success) {
								securitySuccess = (result.data.message as string) || 'Verification email sent';
								showChangeEmail = false;
								clearSecurityForms();
								setTimeout(() => (securitySuccess = ''), 5000);
							}
							await update({ reset: false });
						};
					}}
				>
					<input
						type="email"
						name="newEmail"
						placeholder="New email address"
						bind:value={newEmail}
						required
						disabled={securityLoading}
					/>
					<div class="form-actions">
						<button type="submit" disabled={securityLoading || !newEmail}>
							{securityLoading ? 'Sending...' : 'Send Verification'}
						</button>
						<button
							type="button"
							class="secondary"
							onclick={() => {
								showChangeEmail = false;
								clearSecurityForms();
							}}
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<button
					type="button"
					class="secondary"
					onclick={() => {
						showChangeEmail = true;
						clearSecurityForms();
					}}
				>
					Change Email
				</button>
			{/if}
		</div>

		{#if securitySuccess}
			<p class="success">{securitySuccess}</p>
		{:else if form?.error && lastAction === 'security'}
			<p class="error">{form.error}</p>
		{/if}
	</section>

	{#if data.hasAnonHistory || showHistorySuccess}
		<section>
			<h2>Game History</h2>
			<p>You have game history on this device that isn't linked to your account yet.</p>
			<form
				method="POST"
				action="?/claimHistory"
				use:enhance={() => {
					lastAction = 'history';
					return async ({ result }) => {
						if (result.type === 'success' && result.data?.success) {
							historyMessage =
								(result.data.message as string) || 'Successfully linked your game history.';
							showSuccessFor('history');
						}
					};
				}}
			>
				<button type="submit">Link History to My Account</button>
			</form>
			{#if showHistorySuccess}
				<p class="success">{historyMessage}</p>
			{/if}
		</section>
	{/if}
</div>

<BottomNav
	userId={layoutData.session?.user?.id}
	username={layoutData.session?.user?.username}
	todayGameplayId={layoutData.todayGameplayId}
/>

<style lang="scss">
	.import-banner {
		background-color: rgba(2, 207, 183, 0.15);
		border: 1px solid #02cfb7;
		color: #02cfb7;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		text-align: center;
		font-size: 0.95rem;
		margin-bottom: 0.5rem;
	}

	.container {
		display: flex;
		flex-direction: column;
		padding: 2rem 1rem calc(5rem + env(safe-area-inset-bottom));
		max-width: 500px;
		margin: 0 auto;
		gap: 1.5rem;

		@media (min-width: 768px) {
			padding: 2rem 1rem 2rem calc(1rem + 70px);
			max-width: calc(500px + 70px);
		}
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;

		.title {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		.email {
			font-size: 1.1rem;
			color: #888888;
			margin: 0;
		}
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		line-height: 1;
	}

	h2 {
		font-size: 1.4rem;
		margin: 0 0 1rem;
		color: #eeeeee;
	}

	h3 {
		font-size: 1.1rem;
		margin: 1.5rem 0 0.75rem;
		color: #cccccc;
	}

	.sign-out {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		background-color: rgba(255, 255, 255, 0.05);
		color: #dddddd;
		border: 1px solid #666666;
		border-radius: 4px;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;

		&:hover {
			color: #eeeeee;
			border-color: #999999;
			background-color: rgba(255, 255, 255, 0.1);
		}
	}

	section {
		padding: 1.25rem;
		border: 1px solid #444444;
		border-radius: 8px;
		background-color: rgba(255, 255, 255, 0.02);
	}

	p {
		color: #bbbbbb;
		font-size: 0.95rem;
		margin: 0 0 1rem;
		line-height: 1.4;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;

		.hint {
			color: #888888;
			font-size: 0.8rem;
		}
	}

	label {
		font-size: 0.9rem;
		color: #bbbbbb;
	}

	input[type='text'],
	input[type='password'],
	input[type='email'],
	select {
		padding: 0.75rem 1rem;
		font-size: 1rem;
		border: 1px solid #888888;
		border-radius: 4px;
		width: 100%;
		box-sizing: border-box;
		background-color: transparent;
		color: #eeeeee;
		outline: none;

		&::placeholder {
			color: #999999;
			opacity: 1;
		}

		&:focus {
			border-color: #aaaaaa;
			color: #ffffff;
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	select {
		cursor: pointer;
		padding-right: 2.5rem;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;

		option {
			background-color: #333333;
			color: #eeeeee;
		}
	}

	button {
		padding: 0.75rem 1rem;
		font-size: 1rem;
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

		&:hover:not(:disabled) {
			opacity: 0.9;
		}

		&:active:not(:disabled) {
			transform: translateY(4px);
			box-shadow: none;
		}

		&.small {
			padding: 0.4rem 0.75rem;
			font-size: 0.85rem;
			box-shadow: 0 3px 0 #999999;

			&:active {
				transform: translateY(3px);
				box-shadow: none;
			}
		}

		&.danger {
			background-color: transparent;
			color: #ff6f6f;
			border: 1px solid #ff6f6f;
			box-shadow: none;

			&:hover {
				background-color: rgba(255, 111, 111, 0.1);
			}

			&:active {
				transform: translateY(2px);
			}
		}

		&.icon-btn {
			padding: 0.4rem;
			background-color: transparent;
			border: none;
			box-shadow: none;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;

			&:hover {
				background-color: rgba(255, 255, 255, 0.1);
			}

			&:active {
				transform: translateY(1px);
			}

			&.danger {
				color: #ff6f6f;

				&:hover {
					background-color: rgba(255, 111, 111, 0.15);
				}
			}
		}
	}

	.badge {
		background-color: #444444;
		color: #bbbbbb;
		padding: 0.35rem;
		border-radius: 4px;
		font-size: 0.75rem;

		&.connected {
			background-color: rgba(2, 207, 183, 0.2);
			color: #02cfb7;
		}
	}

	.security-subsection {
		margin-bottom: 1.25rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #444444;

		&:last-child {
			margin-bottom: 0;
			padding-bottom: 0;
			border-bottom: none;
		}

		h3 {
			margin: 0 0 0.75rem;
		}

		p.hint {
			color: #888888;
			font-size: 0.85rem;
			margin: 0 0 0.75rem;
		}
	}

	.signin-methods {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.method {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background-color: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
		border: 1px solid #555555;
	}

	.method-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: #dddddd;

		svg {
			flex-shrink: 0;
		}
	}

	.method-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;

		form {
			flex-direction: row;
		}
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;

		button {
			flex: 1;
		}
	}

	.current-value {
		color: #999999;
		font-size: 0.9rem;
		margin: 0 0 0.75rem;
	}

	button.secondary {
		background-color: transparent;
		color: #dddddd;
		border: 1px solid #666666;
		box-shadow: none;

		&:hover:not(:disabled) {
			background-color: rgba(255, 255, 255, 0.05);
			border-color: #888888;
		}

		&:active:not(:disabled) {
			transform: translateY(2px);
		}
	}

	.error {
		color: #ff6f6f;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.success {
		color: #02cfb7;
		font-size: 0.9rem;
		margin: 0.75rem 0 0;
	}
</style>
