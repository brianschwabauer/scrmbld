// Minimal service worker type declarations — this file shares tsconfig with
// the app but runs in a different global scope. The webworker lib conflicts
// with DOM types, so we declare only what we need.
interface SWEvent {
	waitUntil(promise: Promise<unknown>): void;
}

interface SWPushEvent extends SWEvent {
	data: { json(): unknown; text(): string } | null;
}

interface SWNotificationEvent extends SWEvent {
	notification: { close(): void; data?: Record<string, unknown> };
}

interface SWClient {
	url: string;
	focus(): Promise<SWClient>;
	navigate(url: string): Promise<SWClient>;
}

interface SWGlobalScope {
	registration: {
		showNotification(title: string, options?: Record<string, unknown>): Promise<void>;
	};
	clients: {
		matchAll(options?: { type?: string; includeUncontrolled?: boolean }): Promise<SWClient[]>;
		openWindow(url: string): Promise<SWClient | null>;
		claim(): Promise<void>;
	};
	location: { origin: string };
	addEventListener(type: 'push', listener: (event: SWPushEvent) => void): void;
	addEventListener(type: 'notificationclick', listener: (event: SWNotificationEvent) => void): void;
	addEventListener(type: 'activate', listener: (event: SWEvent) => void): void;
}

const sw = self as unknown as SWGlobalScope;

// Notification type configuration
type NotificationType =
	| 'friend_request'
	| 'friend_accepted'
	| 'daily_reminder'
	| 'weekly_leaderboard';

interface NotificationConfig {
	tag: string;
	icon: string;
	defaultUrl: string;
}

const notificationConfig: Record<NotificationType, NotificationConfig> = {
	friend_request: {
		tag: 'scrmbld-friend-request',
		icon: '/favicon.png',
		defaultUrl: '/friends',
	},
	friend_accepted: {
		tag: 'scrmbld-friend-accepted',
		icon: '/favicon.png',
		defaultUrl: '/friends',
	},
	daily_reminder: {
		tag: 'scrmbld-reminder',
		icon: '/favicon.png',
		defaultUrl: '/play',
	},
	weekly_leaderboard: {
		tag: 'scrmbld-weekly-recap',
		icon: '/favicon.png',
		defaultUrl: '/friends',
	},
};

// Push notification handler
sw.addEventListener('push', (event) => {
	if (!event.data) return;

	try {
		const payload = event.data.json() as {
			title: string;
			body: string;
			url?: string;
			icon?: string;
			type?: NotificationType;
			data?: Record<string, unknown>;
		};

		const type = payload.type || 'daily_reminder';
		const config = notificationConfig[type] || notificationConfig.daily_reminder;

		const options = {
			body: payload.body,
			icon: payload.icon || config.icon,
			badge: '/favicon.png',
			data: {
				url: payload.url || config.defaultUrl,
				type,
				...payload.data,
			},
			tag: config.tag,
			renotify: true,
		};

		event.waitUntil(sw.registration.showNotification(payload.title, options));
	} catch {
		// Fallback for non-JSON payloads
		const text = event.data.text();
		event.waitUntil(
			sw.registration.showNotification('SCRMBLD', {
				body: text,
				icon: '/favicon.png',
			}),
		);
	}
});

// Notification click handler
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const url = (event.notification.data?.url as string) || '/play';

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			// Check if there's already a window open
			for (const client of clients) {
				if (client.url.indexOf(sw.location.origin) !== -1 && 'focus' in client) {
					client.navigate(url);
					return client.focus();
				}
			}
			// Open a new window
			return sw.clients.openWindow(url);
		}),
	);
});

// Activate immediately
sw.addEventListener('activate', (event) => {
	event.waitUntil(sw.clients.claim());
});
