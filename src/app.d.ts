// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

/** Service binding to the notifications DO worker */
interface NotificationsService {
	subscribe(data: {
		userId: string;
		endpoint: string;
		p256dh: string;
		auth: string;
		timezone?: string;
		deviceName?: string;
		deviceId?: string;
	}): Promise<{ success: boolean }>;
	unsubscribe(userId: string, endpoint?: string): Promise<{ success: boolean }>;
	played(userId: string, day: number): Promise<{ success: boolean }>;
	status(): Promise<{
		subscriptions: number;
		sentToday: number;
		nextAlarm: number | null;
		timezones: Record<string, number>;
	}>;
	trigger(): Promise<{ success: boolean; message: string }>;
	initAlarm(): Promise<{ success: boolean; message: string }>;
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			caches: {
				open(cacheName: string): Promise<App.Cache>;
				readonly default: App.Cache;
			};
			context: EventContext<CloudflareEnvVariables, any, any>;
			env: CloudflareEnvVariables;
			cf: CfProperties;
		}
		interface CloudflareEnvVariables {
			D1: D1Database;
			RESEND_API_KEY: string;
			GOOGLE_CLIENT_ID: string;
			GOOGLE_CLIENT_SECRET: string;
			VAPID_PUBLIC_KEY: string;
			VAPID_PRIVATE_KEY: string;
			NOTIFICATIONS: NotificationsService;
		}
	}
}

export {};
