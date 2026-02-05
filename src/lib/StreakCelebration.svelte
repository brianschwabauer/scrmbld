<script lang="ts">
	import Confetti from 'svelte-confetti';

	type Props = {
		streak: number;
		show: boolean;
		onfinish?: () => void;
	};

	let { streak, show, onfinish }: Props = $props();

	// Track badge visibility states for enter/exit animations
	let badgeVisible = $state(false);
	let badgeExiting = $state(false);
	let celebrationActive = $state(false);

	const isMilestone = $derived(streak === 7 || streak === 30 || streak === 100 || streak === 365);
	const EXIT_ANIMATION_DURATION = 400;

	// Show badge when show becomes true, then auto-hide after animation completes
	$effect(() => {
		if (show) {
			celebrationActive = true;
			badgeExiting = false;
			if (isMilestone) {
				badgeVisible = true;
			}
			// Start exit animation before confetti finishes
			const confettiDuration = isMilestone ? 5000 : 4000;
			const badgeDisplayTime = confettiDuration - EXIT_ANIMATION_DURATION;

			const exitTimer = setTimeout(() => {
				badgeExiting = true;
			}, badgeDisplayTime);

			// Remove badge and finish after exit animation completes
			const finishTimer = setTimeout(() => {
				badgeVisible = false;
				celebrationActive = false;
				onfinish?.();
			}, confettiDuration + 100);

			return () => {
				clearTimeout(exitTimer);
				clearTimeout(finishTimer);
			};
		}
	});

	const milestoneLabel = $derived.by(() => {
		if (streak >= 365) return '1 YEAR!';
		if (streak >= 100) return '100 DAYS!';
		if (streak >= 30) return '30 DAYS!';
		if (streak >= 7) return '1 WEEK!';
		return '';
	});

	const confettiAmount = $derived.by(() => {
		if (streak >= 100) return 400;
		if (streak >= 30) return 300;
		if (streak >= 7) return 200;
		return 150;
	});
</script>

{#if celebrationActive && isMilestone}
	<div class="celebration">
		<div class="confetti-container">
			<Confetti
				colorRange={[120, 250]}
				x={[-5, 5]}
				y={[0, 8]}
				amount={confettiAmount}
				destroyOnComplete
				disableForReducedMotion
				rounded
				duration={5000}
				fallDistance="200px"
				iterationCount={1}
			/>
		</div>
		{#if badgeVisible}
			<div class="milestone-badge" class:exiting={badgeExiting}>
				<span class="fire">🔥</span>
				<span class="label">{milestoneLabel}</span>
				<span class="count">{streak} day streak</span>
			</div>
		{/if}
	</div>
{:else if celebrationActive}
	<div class="confetti-simple">
		<Confetti
			colorRange={[120, 250]}
			x={[-5, 5]}
			y={[0, 8]}
			amount={150}
			destroyOnComplete
			disableForReducedMotion
			rounded
			duration={4000}
			fallDistance="200px"
			iterationCount={1}
		/>
	</div>
{/if}

<style lang="scss">
	.celebration {
		position: fixed;
		inset: 0;
		z-index: 50;
		pointer-events: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.confetti-container,
	.confetti-simple {
		position: fixed;
		bottom: 0;
		left: 50%;
	}

	.milestone-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		animation: milestone-pop-in 0.5s ease-out forwards;
		background-color: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		padding: 1.5rem 2rem;
		border-radius: 12px;
		border: 2px solid #02cfb7;

		&.exiting {
			animation: milestone-pop-out 0.4s cubic-bezier(0.6, -0.28, 0.74, 0.05) forwards;
		}

		.fire {
			font-size: 3rem;
		}

		.label {
			font-size: 1.75rem;
			font-weight: bold;
			color: #02cfb7;
			margin-top: 0.25rem;
		}

		.count {
			font-size: 1rem;
			color: #bbbbbb;
			margin-top: 0.25rem;
		}
	}

	@keyframes milestone-pop-in {
		0% {
			transform: scale(0);
			opacity: 0;
		}
		50% {
			transform: scale(1.15);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes milestone-pop-out {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		30% {
			transform: scale(1.2);
			opacity: 1;
		}
		100% {
			transform: scale(0);
			opacity: 0;
		}
	}
</style>
