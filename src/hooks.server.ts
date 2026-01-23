import { initAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.platform?.env?.D1) {
		const auth = initAuth(event.platform.env.D1, event.platform.env);
		return svelteKitHandler({ event, resolve, auth, building });
	}
	return resolve(event);
};
