import type { Action } from 'svelte/action';

/** Shows a tooltip message when the element is hovered/focused */
export const tooltip: Action<HTMLElement, string> = (parent, tooltipMessage) => {
	const oldDescribeBy = parent.getAttribute('aria-describedby');
	let destroyFloatingUi = () => {};
	let el: HTMLDivElement | undefined;
	let message = (tooltipMessage || '').trim();
	let destroyed = false;

	function showTooltip() {
		if (!el) return;
		el.style.transform = 'scale(1)';
		el.style.opacity = '1';
	}

	function hideTooltip() {
		if (!el) return;
		el.style.transform = 'scale(.65)';
		el.style.opacity = '0';
	}

	let pointerEntered = false;
	let showTimer: ReturnType<typeof setTimeout>;
	function delayShowTooltip(e: PointerEvent | FocusEvent) {
		if (e.type !== 'focus') pointerEntered = true;
		if ('pointerType' in e && e.pointerType === 'touch') return;
		if (e.type === 'focus' && !pointerEntered) return;
		createTooltip();
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
		showTimer = setTimeout(() => showTooltip(), 400);
	}

	let hideTimer: ReturnType<typeof setTimeout>;
	function delayHideTooltip(e: PointerEvent | FocusEvent) {
		if (e.type !== 'focus' && e.type !== 'blur') pointerEntered = false;
		pointerEntered = false;
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => hideTooltip(), 200);
	}
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') hideTooltip();
	}

	async function createTooltip() {
		if (el) return;
		el = document.createElement('div');
		el.setAttribute('role', 'tooltip');
		el.setAttribute('inert', 'true');
		el.innerText = message || '';
		Object.assign(el.style, {
			display: 'block',
			width: 'max-content',
			position: 'absolute',
			top: '0',
			left: '0',
			background: 'rgba(0, 0, 0, .75)',
			color: 'white',
			padding: '10px 14px',
			opacity: '0',
			transform: 'scale(.65)',
			transition: `transform 150ms ease, opacity 150ms`,
			'backdrop-filter': 'blur(10px)',
			'pointer-events': 'none',
			'z-index': '100',
			'max-width': 'min(40ch, 90vw)',
			'border-radius': '10px',
			'font-size': '90%',
			'line-height': '1.3'
		});
		let portal = document.querySelector('#tooltips');
		if (!portal) {
			portal = document.createElement('div');
			portal.id = 'tooltips';
			document.body.appendChild(portal);
		}
		portal.appendChild(el);
		const { computePosition, autoUpdate, flip, offset, shift } = await import('@floating-ui/dom');
		destroyFloatingUi();
		if (destroyed) return;
		destroyFloatingUi = autoUpdate(parent, el, async () => {
			if (!parent || !el) return;
			const { placement, x, y } = await computePosition(parent, el, {
				placement: 'top',
				strategy: 'absolute',
				middleware: [offset(8), flip(), shift()]
			});
			Object.assign(el.style, {
				left: `${x}px`,
				top: `${y}px`,
				'transform-origin': `${placement === 'top' ? 'bottom' : 'top'} center`
			});
		});
	}

	function startListening() {
		parent.addEventListener('pointerenter', delayShowTooltip);
		parent.addEventListener('pointerleave', delayHideTooltip);
		parent.addEventListener('focus', delayShowTooltip);
		parent.addEventListener('blur', delayHideTooltip);
		parent.addEventListener('keyup', onKeyDown);
	}
	function destroy() {
		destroyed = true;
		parent.removeEventListener('pointerenter', delayShowTooltip);
		parent.removeEventListener('pointerleave', delayHideTooltip);
		parent.removeEventListener('focus', delayShowTooltip);
		parent.removeEventListener('blur', delayHideTooltip);
		parent.removeEventListener('keyup', onKeyDown);
		parent.setAttribute('aria-describedby', oldDescribeBy || '');
		destroyFloatingUi();
		if (el) el.remove();
		if (el) el = undefined;
	}

	if (message) startListening();

	return {
		update: (newMessage) => {
			message = (newMessage || '').trim();
			if (!message) return destroy();
			if (!el) {
				destroyed = false;
				startListening();
			} else {
				el.innerText = message;
			}
		},
		destroy
	};
};
