<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let name = $state(data.user?.name || '');
	let username = $state(data.user?.username || '');
	let saving = $state(false);
</script>

<div class="container">
	<h1>Set up your profile</h1>
	<p>Add some details to your account. You can always change these later.</p>

	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				saving = false;
				await update({ reset: false });
			};
		}}
	>
		<input
			type="text"
			name="name"
			placeholder="Display Name (optional)"
			bind:value={name}
			disabled={saving}
		/>

		<input
			type="text"
			name="username"
			placeholder="Username (optional)"
			bind:value={username}
			disabled={saving}
		/>

		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}

		<button type="submit" disabled={saving}>
			{saving ? 'Saving...' : 'Save'}
		</button>
	</form>

	<form method="POST" action="?/skip" use:enhance>
		<button type="submit" class="skip" disabled={saving}>Skip for now</button>
	</form>
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
		font-size: 2rem;
		margin: 0;
		line-height: 1;
	}

	p {
		font-size: 1rem;
		color: #bbbbbb;
		margin: 0;
		max-width: 350px;
		line-height: 1.4;
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

			&.skip {
				background-color: transparent;
				color: #999999;
				box-shadow: none;
				font-weight: normal;

				&:hover:not(:disabled) {
					color: #eeeeee;
				}

				&:active:not(:disabled) {
					transform: translateY(2px);
				}
			}
		}
	}

	.error {
		color: #ff6f6f;
		font-size: 0.95rem;
		margin: 0;
	}
</style>
