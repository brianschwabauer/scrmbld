<script lang="ts">
	import { scale } from 'svelte/transition';
	import { backOut, backIn } from 'svelte/easing';
	import { browser } from '$app/environment';
	import type { Placement, Strategy } from '@floating-ui/dom';
	import { tick, untrack, type Snippet } from 'svelte';

	let {
		/** The HTML element that the popover will be attached to */
		refElement = undefined as HTMLElement | undefined,

		/** Whether the popover is currently open */
		opened = $bindable(false) as boolean,

		/** Where the popover should be attempted to be placed (it can move to fit on screen) */
		placement = 'bottom' as Placement,

		/** How the item should be placed with css */
		strategy = 'fixed' as Strategy,

		/** Whether the 'arrow' pointing to the target element should be shown */
		arrow = true,

		/** Whether the popover should open when the ref element is hover overed */
		openOnHover = false,

		/** Whether the popover should open when the ref element is clicked */
		openOnClick = false,

		/** Whether the popover should open when the ref element is focused (closes on blur) */
		openOnFocus = false,

		/** Whether the popover should close when clicked outside of the popover */
		closeOnOutsideClick = true,

		/** Whether the popover should close when a button like element is clicked inside of the popover */
		closeOnInsideClick = false,

		/** Whether the popover should close when the escape key is pressed */
		closeOnEscapeKey = true,

		/** The number of milliseconds that the popover wait before popping up. Only applies when 'openOnHover' is true */
		hoverDelay = 100,

		/** The content shown in the element */
		children = undefined as undefined | Snippet,

		/** Specifies a custom class name for the container element */
		class: className = '',

		/** The css style string added to the component from the parent */
		style = '',
	} = $props();

	const ARROW_SIZE = 20;
	const ARROW_PADDING = 38;
	const OFFSET = 4;
	const OFFSET_WITH_ARROW = 12;
	const TRANSITION_IN_DURATION = 200;
	const TRANSITION_OUT_DURATION = 150;

	let popoverElement = $state<HTMLElement | undefined>(undefined);
	let arrowElement = $state<HTMLElement | undefined>(undefined);
	let left = $state('0px');
	let top = $state('-1000px');
	let hitBoxLength = $state(0); // the total length of the hit box
	let hitBoxLengthA = $state(0); // the length of the long side of the trapezoid
	let hitBoxLengthB = $state(0); // the length of the short side of the trapezoid
	let hitBoxLengthZ = $state(0); // the length of the 'height' of the trapezoid
	let hitBoxOffsetA = $state(0); // How far the long side of the trapezoid is from the edge of the hit box
	let hitBoxOffsetB = $state(0); // How far the short side of the trapezoid is from the edge of the hit box
	let transformOrigin = $state(`top center`);
	let arrowX = $state('');
	let arrowY = $state('');
	let realPlacement = $state(placement);
	let forcedOpened = $state(false);
	let popoverPositionDestroy = () => {};

	const hitBoxShape = $derived.by(() => {
		const points: string[] = [];
		if (realPlacement.startsWith('bottom')) {
			points.push(`M${hitBoxOffsetA},${hitBoxLengthZ}`);
			points.push(`L${hitBoxOffsetB},0`);
			points.push(`l${hitBoxLengthB},0`);
			points.push(`L${hitBoxOffsetA + hitBoxLengthA},${hitBoxLengthZ}`);
			points.push(`L${hitBoxOffsetA},${hitBoxLengthZ}`);
		} else if (realPlacement.startsWith('top')) {
			points.push(`M${hitBoxOffsetA},0`);
			points.push(`L${hitBoxOffsetB},${hitBoxLengthZ}`);
			points.push(`l${hitBoxLengthB},0`);
			points.push(`L${hitBoxOffsetA + hitBoxLengthA},0`);
			points.push(`L${hitBoxOffsetA},0`);
		} else if (realPlacement.startsWith('left')) {
			points.push(`M0,${hitBoxOffsetA}`);
			points.push(`L${hitBoxLengthZ},${hitBoxOffsetB}`);
			points.push(`l0,${hitBoxLengthB}`);
			points.push(`L0,${hitBoxOffsetA + hitBoxLengthA}`);
			points.push(`L0,${hitBoxOffsetA}`);
		} else if (realPlacement.startsWith('right')) {
			points.push(`M${hitBoxLengthZ},${hitBoxOffsetA}`);
			points.push(`L0,${hitBoxOffsetB}`);
			points.push(`l0,${hitBoxLengthB}`);
			points.push(`L${hitBoxLengthZ},${hitBoxOffsetA + hitBoxLengthA}`);
			points.push(`L${hitBoxLengthZ},${hitBoxOffsetA}`);
		}
		return points.join(' ');
	});

	// Determine when the portal component should be shown
	// This is necessary because the portal component needs to exist while the popover is animating away
	let portalOpened = $state(false);
	let portalOpenedTimeout: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		clearTimeout(portalOpenedTimeout);
		if (opened) {
			portalOpened = true;
		} else {
			portalOpenedTimeout = setTimeout(() => {
				if (untrack(() => !opened)) portalOpened = false;
			}, TRANSITION_OUT_DURATION);
		}
	});

	// Show the popover with a small delay to trigger the intro animation to play
	let shown = $state(false);
	$effect(() => {
		if (opened) {
			tick().then(() => (shown = true));
		} else {
			shown = false;
		}
	});

	/** Determines the position of the popover panel so that it fits on screen */
	async function initPopoverPosition() {
		if (!browser || !refElement) return;
		let bounds: DOMRect;
		let borderRadius: number;
		const {
			computePosition,
			autoUpdate,
			flip,
			offset,
			arrow: arrowMiddleware,
			shift,
		} = await import('@floating-ui/dom');
		popoverPositionDestroy();
		popoverPositionDestroy = autoUpdate(refElement, popoverElement!, async () => {
			if (!refElement || !popoverElement || !opened) return;
			const {
				placement: calculatedPlacement,
				x,
				y,
				middlewareData,
			} = await computePosition(refElement, popoverElement, {
				placement,
				strategy,
				middleware: [
					offset({ mainAxis: arrow ? OFFSET_WITH_ARROW : OFFSET }),
					flip({ crossAxis: false }),
					shift(),
					...(!arrow
						? []
						: [arrowMiddleware({ element: arrowElement!, padding: ARROW_PADDING })]),
				],
			});
			if (openOnHover && untrack(() => !forcedOpened)) {
				if (borderRadius === undefined) {
					borderRadius = parseInt(getComputedStyle(popoverElement).borderRadius);
				}
				if (!bounds || calculatedPlacement !== untrack(() => realPlacement)) {
					bounds = refElement.getBoundingClientRect();
				}
				if (
					calculatedPlacement.startsWith('top') ||
					calculatedPlacement.startsWith('bottom')
				) {
					hitBoxLengthZ =
						Math.min(16, bounds.height / 2) + (arrow ? OFFSET_WITH_ARROW : OFFSET);
					hitBoxLength = popoverElement.clientWidth;
					hitBoxLengthA = popoverElement.clientWidth - borderRadius * 2;
					hitBoxLengthB = bounds.width;
					hitBoxOffsetA = borderRadius;
					hitBoxOffsetB = bounds.x - x;
				} else {
					hitBoxLengthZ =
						Math.min(16, bounds.width / 2) + (arrow ? OFFSET_WITH_ARROW : OFFSET);
					hitBoxLength = popoverElement.clientHeight;
					hitBoxLengthA = popoverElement.clientHeight - borderRadius * 2;
					hitBoxLengthB = bounds.height;
					hitBoxOffsetA = borderRadius;
					hitBoxOffsetB = bounds.y - y;
				}
			}
			realPlacement = calculatedPlacement;
			left = `${x}px`;
			top = `${y}px`;
			transformOrigin = `${calculatedPlacement === 'top' ? 'bottom' : 'top'} center`;
			if (middlewareData.arrow) {
				arrowX = middlewareData.arrow?.x ? `${middlewareData.arrow.x || 0}px` : '';
				arrowY = middlewareData.arrow?.y ? `${middlewareData.arrow.y || 0}px` : '';
			}
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
	}

	$effect(() => {
		if (shown) {
			initPopoverPosition();
		} else {
			popoverPositionDestroy();
		}
		return () => popoverPositionDestroy();
	});

	// Handle the popover opening and closing when the ref element is hovered over
	let stopMouseDownListener = () => {};
	let stopMouseMoveListener = () => {};
	let refListeners: Array<() => void> = [];
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	function stopRefListeners() {
		refListeners.forEach((destroy) => destroy());
		refListeners = [];
	}
	function stopListeners() {
		stopRefListeners();
		stopMouseDownListener();
		stopMouseMoveListener();
	}
	let willOpen = false;

	/** Handles when a mouse moves (after the popoever has been opened on hover). Used to close popover when moved off */
	function onMouseMove(e: MouseEvent) {
		if (!refElement) return;
		if (untrack(() => forcedOpened)) return stopMouseMoveListener();
		let el = e.target as HTMLElement | null | undefined;
		let isHoveringOverPopover = false;
		if (el && !el.classList.contains('popover-hit-box')) {
			while (el) {
				if (
					el === popoverElement ||
					el === refElement ||
					el.classList.contains('popover-hit-shape')
				) {
					isHoveringOverPopover = true;
					break;
				}
				el = el?.parentElement;
			}
		}
		if (isHoveringOverPopover) {
			if (!willOpen) willOpen = true;
			return;
		}
		if (untrack(() => !opened)) portalOpened = false;
		opened = false;
		willOpen = false;
		stopMouseMoveListener();
		clearTimeout(debounceTimer);
	}

	/** Handles when the user clicks outside the popover (and thus is should close) */
	function onPointerDown(e: MouseEvent) {
		let el = e.target as HTMLElement | null | undefined;
		let isOutsideClick = true;
		while (el) {
			if (el === popoverElement || el === refElement) {
				isOutsideClick = false;
				break;
			}
			el = el?.parentElement;
		}
		if (isOutsideClick) {
			opened = false;
			willOpen = false;
			forcedOpened = false;
			stopMouseDownListener();
		}
	}

	/** Handles when the mouse enters the popover's target/trigger element. Used to open the popover on hover */
	function onRefElementMouseEnter(e: MouseEvent) {
		willOpen = false;
		clearTimeout(debounceTimer);
		if (untrack(() => forcedOpened)) return stopMouseMoveListener();
		if (!refElement) {
			opened = false;
			forcedOpened = false;
			return;
		}
		debounceTimer = setTimeout(() => {
			if (untrack(() => forcedOpened)) return;
			if (untrack(() => opened)) return;
			if (!willOpen) return;
			opened = true;
		}, hoverDelay);
		portalOpened = true;
		willOpen = true;
		document.addEventListener('mousemove', onMouseMove);
		stopMouseMoveListener = () => {
			document.removeEventListener('mousemove', onMouseMove);
		};
	}

	/**
	 * Prevents the pointer up event from propagating
	 * This is a hack to fix the mouse-delay-after-gesture issue
	 * See the use:pointerupOverride action for more information
	 */
	function onRefElementPointerUp(e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	/** Handles when the user clicks on the popover's target/trigger element. Used to force open the popover */
	function onRefElementClick(e: MouseEvent) {
		let el = e.target as HTMLElement | null | undefined;

		// Check if the hit box shape was clicked. If so, we need to check if the click would have hit the trigger element
		if (el && el.classList.contains('popover-hit-shape')) {
			el.style.pointerEvents = 'none';
			let triggerEl = document.elementFromPoint(e.clientX, e.clientY);
			let isRefElement = false;
			while (triggerEl) {
				if (triggerEl === refElement) {
					isRefElement = true;
					break;
				}
				triggerEl = triggerEl.parentElement;
			}
			el.style.removeProperty('pointer-events');
			if (!isRefElement) return;
		}
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		if (untrack(() => opened) && untrack(() => forcedOpened)) {
			willOpen = false;
			opened = false;
			forcedOpened = false;
			stopMouseDownListener();
			return;
		}
		forcedOpened = true;
		willOpen = true;
		opened = true;
		document.addEventListener('pointerdown', onPointerDown);
		stopMouseDownListener = () => {
			document.removeEventListener('pointerdown', onPointerDown);
		};
	}

	/** Handles when the user presses enter/escape when the trigger element is focused */
	function onRefElementKeyUp(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			opened = false;
			forcedOpened = false;
			e.preventDefault();
			e.stopPropagation();
		}
		// We should ignore events that are on button like elements
		// because they will trigger the click event (which will toggle the popover)
		// If this also runs, it will toggle the popover twice
		const isButtonLike =
			e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
		if (!isButtonLike && (e.key === 'Enter' || e.key === ' ')) {
			if (untrack(() => forcedOpened)) {
				opened = !untrack(() => opened);
				forcedOpened = !untrack(() => opened);
			} else {
				forcedOpened = true;
			}
			e.preventDefault();
			e.stopPropagation();
		}
	}

	/** Handles when the trigger element is no longer in focus and thus should be closed (if open) */
	function onRefElementBlur(e: FocusEvent) {
		if (!refElement) return;
		refElement.removeEventListener('blur', onRefElementBlur);
		refElement.removeEventListener('keyup', onRefElementKeyUp);
		if (untrack(() => forcedOpened)) return;
		if (!untrack(() => opened)) return;
		opened = false;
	}

	/** Handles when the trigger element is focused. If so, the panel will be opened if openOnFocus is true */
	function onRefElementFocus(e: FocusEvent) {
		if (!refElement) return;
		refElement.addEventListener('blur', onRefElementBlur);
		if (closeOnEscapeKey) {
			refElement.addEventListener('keyup', onRefElementKeyUp);
		}
		if (untrack(() => forcedOpened)) return;
		if (untrack(() => opened)) return;
		portalOpened = true;
		tick().then(() => {
			// Delay opening the popover by a frame so the the animation in effect will work
			opened = true;
		});
	}

	/** Handles when the user presses escape when the portal element is focused */
	function onPortalElementKeyUp(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			opened = false;
			forcedOpened = false;
			e.preventDefault();
			e.stopPropagation();
		}
	}

	// Add event listeners when the refElement is set
	$effect(() => {
		if (!refElement || (!openOnHover && !openOnClick && !openOnFocus)) return;
		stopListeners();
		if (openOnHover) {
			refElement.addEventListener('mouseenter', onRefElementMouseEnter);
		} else {
			refElement.removeEventListener('mouseenter', onRefElementMouseEnter);
		}
		if (openOnClick) {
			refElement.addEventListener('click', onRefElementClick);
			refElement.addEventListener('pointerup', onRefElementPointerUp);
		} else {
			refElement.removeEventListener('click', onRefElementClick);
		}
		if (openOnFocus) {
			refElement.addEventListener('focus', onRefElementFocus);
			refElement.tabIndex = 0;
		} else {
			if (closeOnEscapeKey) {
				refElement.addEventListener('keyup', onRefElementKeyUp);
			} else {
				refElement.removeEventListener('keyup', onRefElementKeyUp);
			}
			refElement.removeEventListener('focus', onRefElementFocus);
			refElement.removeAttribute('tabindex');
		}
		refListeners.push(
			() => refElement?.removeEventListener('mouseenter', onRefElementMouseEnter),
			() => refElement?.removeEventListener('click', onRefElementClick),
			() => refElement?.removeEventListener('pointerup', onRefElementPointerUp),
			() => refElement?.removeEventListener('focus', onRefElementFocus),
			() => refElement?.removeEventListener('keyup', onRefElementKeyUp),
		);
		return () => stopListeners();
	});
</script>

{#snippet popover()}
	{#if shown}
		<div
			class="popover {className}"
			style:position={strategy}
			bind:this={popoverElement}
			{style}
			style:left
			style:top
			style:transform-origin={transformOrigin}
			role="presentation"
			onkeyup={onPortalElementKeyUp}
			onclick={(e) => {
				if (!closeOnInsideClick) return;
				let element = e.target as HTMLElement;
				let isButtonLike = false;
				while (element) {
					if (element.tagName === 'BUTTON' || element.tagName === 'A') {
						isButtonLike = true;
						break;
					}
					element = element.parentElement as HTMLElement;
				}
				if(isButtonLike && opened) opened = false;
			}}
			in:scale={{ start: 0.7, easing: backOut, duration: TRANSITION_IN_DURATION }}
			out:scale={{ start: 0.7, easing: backIn, duration: TRANSITION_OUT_DURATION }}>
			{#if children}{@render children()}{/if}
			{#if arrow}
				<div
					class="arrow"
					class:bottom={realPlacement.startsWith('top')}
					class:top={realPlacement.startsWith('bottom')}
					class:left={realPlacement.startsWith('right')}
					class:right={realPlacement.startsWith('left')}
					bind:this={arrowElement}
					style:--arrow-size={`${ARROW_SIZE}px`}
					style:left={arrowX}
					style:top={arrowY}>
				</div>
			{/if}
			{#if openOnHover && !forcedOpened}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="popover-hit-box"
					width={realPlacement.startsWith('bottom') || realPlacement.startsWith('top')
						? hitBoxLength
						: hitBoxLengthZ}
					height={realPlacement.startsWith('bottom') || realPlacement.startsWith('top')
						? hitBoxLengthZ
						: hitBoxLength}
					viewBox={realPlacement.startsWith('bottom') || realPlacement.startsWith('top')
						? `0 0 ${hitBoxLength} ${hitBoxLengthZ}`
						: `0 0 ${hitBoxLengthZ} ${hitBoxLength}`}
					style:pointer-events="none"
					style:position="absolute"
					style:top={realPlacement.startsWith('top')
						? '100%'
						: realPlacement.startsWith('bottom')
							? ''
							: '0px'}
					style:bottom={realPlacement.startsWith('bottom') ? '100%' : ''}
					style:left={realPlacement.startsWith('left')
						? '100%'
						: realPlacement.startsWith('right')
							? ''
							: '0px'}
					style:right={realPlacement.startsWith('right') ? '100%' : ''}>
					<path
						class="popover-hit-shape"
						onclick={onRefElementClick}
						role="presentation"
						d={hitBoxShape}
						fill="transparent">
					</path>
				</svg>
			{/if}
		</div>
	{/if}
{/snippet}

{@render popover()}

<style lang="scss">
	.popover-hit-box {
		pointer-events: none;
	}
	.popover-hit-shape {
		pointer-events: all;
	}
	.popover {
		--radius: 20px;
		--bg: #ffffff;
		--layer: 5;
		--easing: var(--ease-out-back);
		--shadow-hls: 220 3% 15%;
		--shadow-strength: 15%;
		--shadow:
			0 -1px 3px 0 hsl(var(--shadow-hls) / calc(var(--shadow-strength) + 2%)),
			0 1px 2px -5px hsl(var(--shadow-hls) / calc(var(--shadow-strength) + 2%)),
			0 2px 5px -5px hsl(var(--shadow-hls) / calc(var(--shadow-strength) + 4%)),
			0 4px 12px -5px hsl(var(--shadow-hls) / calc(var(--shadow-strength) + 5%)),
			0 12px 15px -5px hsl(var(--shadow-hls) / calc(var(--shadow-strength) + 7%));
		
		z-index: var(--layer);
		background-color: var(--bg);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		max-width: calc(100vw - 1rem);
		max-height: calc(100vh - 1rem);
		transition: none;
		.arrow {
			position: absolute;
			pointer-events: none;
			background-color: var(--bg);
			width: calc(var(--arrow-size) / 2);
			height: calc(var(--arrow-size) / 2);
			top: calc(var(--arrow-size) / -2);
			&.bottom {
				top: 100%;
				transform: rotate(180deg);
			}
			&.left {
				right: 100%;
				transform: rotate(270deg);
			}
			&.right {
				left: 100%;
				transform: rotate(90deg);
			}
			&::before,
			&::after {
				content: '';
				position: absolute;
				height: var(--arrow-size);
				width: var(--arrow-size);
				bottom: 0;
			}

			&::after {
				right: calc(var(--arrow-size) * -1 + 3px);
				border-radius: 0 0 0 var(--arrow-size);
				box-shadow: min(-2px, calc(var(--arrow-size) / -2 + 8px)) 8px 0 0 var(--bg);
			}

			&::before {
				left: calc(var(--arrow-size) * -1 + 3px);
				border-radius: 0px 0px var(--arrow-size) 0;
				box-shadow: max(2px, calc(var(--arrow-size) / 2 - 8px)) 8px 0 0 var(--bg);
			}
		}
	}
</style>
