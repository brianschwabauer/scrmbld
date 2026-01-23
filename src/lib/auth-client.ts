import { createAuthClient } from 'better-auth/svelte';
import { usernameClient, magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL, // Optional if same origin
	plugins: [usernameClient(), magicLinkClient()],
});

export const { signIn, signUp, useSession, signOut } = authClient;
