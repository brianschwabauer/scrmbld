import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink, username } from 'better-auth/plugins';
import { Resend } from 'resend';
import { createDb } from './db';
import * as schema from './schema';

export function initAuth(d1: D1Database, env: any) {
	const db = createDb(d1);
	const resend = new Resend(env.RESEND_API_KEY || 're_123');

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: {
				...schema,
			},
		}),
		emailAndPassword: {
			enabled: true,
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID || 'placeholder',
				clientSecret: env.GOOGLE_CLIENT_SECRET || 'placeholder',
			},
		},
		plugins: [
			username(),
			magicLink({
				sendMagicLink: async ({ email, token, url }, request) => {
					console.log(`Sending magic link to ${email}: ${url}`);
					try {
						await resend.emails.send({
							from: 'Scrmbld <onboarding@resend.dev>',
							to: email,
							subject: 'Sign in to Scrmbld',
							html: `<p>Click <a href="${url}">here</a> to sign in.</p>`,
						});
					} catch (e) {
						console.error('Failed to send email', e);
					}
				},
			}),
		],
		user: {
			additionalFields: {
				privacySettings: {
					type: 'string',
					required: false,
					defaultValue: JSON.stringify({ profile: 'public', show_name: false }),
				},
			},
		},
		trustedOrigins: [env.BETTER_AUTH_URL || 'http://localhost:5173'],
	});
}
