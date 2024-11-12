export interface RippleOptions {
	/** If false, the ripple will be disabled */
	enabled: boolean;

	/** The color of the ripple. @default currentColor */
	color: string;

	/** Whether the ripple should be centered instead of emiting from the touch point */
	centered: boolean;

	/** The opacity of the ripple */
	opacity: number;

	/** The z-index to apply to the ripple @default undefined */
	zIndex: number | undefined;

	/** Whether the ripple element will be appended on to the parent container (instead of prepended)  */
	append: boolean;
}

/** A Svelte action for adding a material design ripple animation to any element */
export function ripple(node: HTMLElement, _options: Partial<RippleOptions> = {}) {
	let options = {
		color: 'currentColor',
		centered: false,
		opacity: 0.1,
		enabled: true,
		zIndex: -1,
		append: false,
		..._options
	};
	let destroyed = false;
	let ripple: HTMLElement | undefined;
	const handleStart = (e: PointerEvent) => (ripple = startRipple(e, options));
	const handleStop = () => stopRipple(ripple);
	const handleKeyboardStart = (e: KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === 'Space') {
			ripple = startRipple(e, { ...options, centered: true });
			stopRipple(ripple);
		}
	};

	function setup() {
		node.classList.add('s-ripple-container');
		node.addEventListener('pointerdown', handleStart);
		node.addEventListener('pointerup', handleStop);
		node.addEventListener('pointerleave', handleStop);
		node.addEventListener('keydown', handleKeyboardStart);
		destroyed = false;
	}

	function destroy() {
		node.classList.remove('s-ripple-container');
		node.removeEventListener('pointerdown', handleStart);
		node.removeEventListener('pointerup', handleStop);
		node.removeEventListener('pointerleave', handleStop);
		node.removeEventListener('keydown', handleKeyboardStart);
		destroyed = true;
	}

	if (options?.enabled) setup();

	return {
		update(newOptions: Partial<RippleOptions>) {
			options = { ...options, ...newOptions };
			if (options.enabled && destroyed) setup();
			else if (!options.enabled && !destroyed) destroy();
		},
		destroy
	};
}

function startRipple(
	e: TouchEvent | PointerEvent | KeyboardEvent,
	options: RippleOptions
): HTMLElement | undefined {
	// Parent element
	const target = ('touches' in e ? e.touches[0].target : e.currentTarget) as HTMLElement;
	if (!target) return;
	if (target.ariaDisabled || (<HTMLButtonElement>target).disabled) return;

	// Create ripple
	const container = document.createElement('div');
	const containerStyle = container.style;
	const ripple = document.createElement('div');
	const rippleStyle = ripple.style;

	// Adding default styling
	container.className = `ripple`;
	containerStyle.zIndex = `${options?.zIndex ?? ''}`;
	containerStyle.position = 'absolute';
	containerStyle.top = '0';
	containerStyle.left = '0';
	containerStyle.right = '0';
	containerStyle.bottom = '0';
	containerStyle.overflow = 'hidden';
	containerStyle.borderRadius = getComputedStyle(target).borderRadius;
	containerStyle.pointerEvents = 'none';
	rippleStyle.position = 'absolute';
	rippleStyle.color = 'inherit';
	rippleStyle.borderRadius = '50%';
	rippleStyle.pointerEvents = 'none';
	rippleStyle.width = '1px';
	rippleStyle.height = '1px';
	rippleStyle.marginTop = '-.5px';
	rippleStyle.marginLeft = '-.5px';

	container.appendChild(ripple);
	if (options.append) target.appendChild(container);
	else target.insertBefore(container, target.firstChild);
	rippleStyle.opacity = `${options.opacity}`;
	const targetRect = target.getBoundingClientRect();
	const touchX = 'touches' in e ? e.touches[0].clientX : (e as unknown as PointerEvent).clientX;
	const touchY = 'touches' in e ? e.touches[0].clientY : (e as unknown as PointerEvent).clientY;
	const left = (touchX - targetRect.left) ** 2;
	const right = (targetRect.left + targetRect.width - touchX) ** 2;
	const top = (touchY - targetRect.top) ** 2;
	const bottom = (targetRect.top + targetRect.height - touchY) ** 2;
	const distToTopLeft = Math.sqrt(top + left);
	const distToTopRight = Math.sqrt(top + right);
	const distToBottomLeft = Math.sqrt(bottom + left);
	const distToBottomRight = Math.sqrt(bottom + right);
	const maxDistance = Math.max(distToTopLeft, distToTopRight, distToBottomLeft, distToBottomRight);
	const scale = maxDistance * 2;

	rippleStyle.transform = 'scale(0) translate(0,0)';
	rippleStyle.background = options.color;

	// Positioning ripple
	if (options.centered) {
		rippleStyle.transition = `transform .5s cubic-bezier(.42,.5,.6,1) 0s,opacity .5s ease-in-out 0s`;
		rippleStyle.top = `${targetRect.height / 2}px`;
		rippleStyle.left = `${targetRect.width / 2}px`;
	} else {
		const duration = Math.max(0.25, Math.min(2, 0.2 + maxDistance * 0.001));
		const transform = `transform ${duration.toFixed(2)}s`;
		const opacity = `opacity ${duration.toFixed(2)}s`;
		const easing = duration < 1 ? 'ease' : `cubic-bezier(.42,.5,.6,1)`;
		rippleStyle.transition = `${transform} ${easing}, ${opacity} ease-in-out`;
		rippleStyle.top = `${touchY - targetRect.top}px`;
		rippleStyle.left = `${touchX - targetRect.left}px`;
	}

	// Enlarge ripple
	rippleStyle.transform = `scale(${scale}) translate(0,0)`;
	return container;
}

function stopRipple(container: HTMLElement | undefined | null) {
	if (!container) return;
	const ripple = container?.firstElementChild as HTMLElement;
	if (!ripple) return;
	const shortestRunningAnimation = Math.min(
		...ripple.getAnimations().map((animation) => parseInt(`${animation.currentTime}`) || Infinity)
	);
	setTimeout(
		() => {
			ripple.addEventListener('transitionend', (e) => {
				if (e.propertyName === 'opacity') container.remove();
			});
			ripple.style.opacity = `0`;
		},
		Math.max(0, 250 - shortestRunningAnimation)
	);
}
