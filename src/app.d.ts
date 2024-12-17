// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
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
		}
	}
}

export {};
