import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink, username } from 'better-auth/plugins';
import { Resend } from 'resend';
import { createDb } from './db';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

export function initAuth(d1: D1Database) {
	const db = createDb(d1);
	const resend = new Resend(env.RESEND_API_KEY);

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: {
				...schema,
			},
		}),
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ['google'],
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
				console.log(`Sending verification email to ${user.email}: ${url}`);
				try {
					await resend.emails.send({
						from: 'Scrmbld <no-reply@updates.scrmbld.app>',
						to: user.email,
						subject: 'Verify your email for Scrmbld',
						html: `<p>Welcome to Scrmbld! Click <a href="${url}">here</a> to verify your email address.</p>`,
					});
				} catch (e) {
					console.error('Failed to send verification email', e);
				}
			},
			sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
				console.log(`Sending password reset to ${user.email}: ${url}`);
				try {
					await resend.emails.send({
						from: 'Scrmbld <no-reply@updates.scrmbld.app>',
						to: user.email,
						subject: 'Reset your Scrmbld password',
						html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
					});
				} catch (e) {
					console.error('Failed to send reset password email', e);
				}
			},
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
							from: 'Scrmbld <no-reply@updates.scrmbld.app>',
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
				profileVisibility: {
					type: 'string',
					required: false,
					defaultValue: 'public',
				},
			},
		},
		trustedOrigins: [env.BETTER_AUTH_URL || 'http://localhost:5173'],
		advanced: {
			cookiePrefix: 'scrmbld-auth',
		},
	});
}
