import { initAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { building } from '$app/environment';

export const handleError: HandleServerError = ({ error, status }) => {
	if (status === 404) {
		return { message: 'Not Found' };
	}
	console.error(error);
	return { message: 'Internal Error' };
};

export const handle: Handle = async ({ event, resolve }) => {
	if (event.platform?.env?.D1) {
		const auth = initAuth(event.platform.env.D1);
		return svelteKitHandler({ event, resolve, auth, building });
	}
	return resolve(event);
};
