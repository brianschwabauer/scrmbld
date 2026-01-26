import { createAuthClient } from 'better-auth/svelte';
import { usernameClient, magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	plugins: [usernameClient(), magicLinkClient()],
});

export const { signIn, signUp, useSession, signOut } = authClient;
