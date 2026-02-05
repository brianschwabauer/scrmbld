#!/usr/bin/env node

/**
 * Generate VAPID keys for Web Push notifications.
 *
 * Usage: node scripts/generate-vapid-keys.js
 *
 * After generating, add these as Cloudflare secrets for both the main app
 * and the notification worker.
 */

import crypto from 'crypto';

// Generate ECDSA P-256 key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
	namedCurve: 'P-256',
});

// Export public key in uncompressed format (for applicationServerKey)
const publicKeyRaw = publicKey.export({ type: 'spki', format: 'der' });
// The raw public key is the last 65 bytes of the SPKI format (uncompressed point)
const publicKeyBytes = publicKeyRaw.slice(-65);
const publicKeyBase64Url = Buffer.from(publicKeyBytes)
	.toString('base64')
	.replace(/\+/g, '-')
	.replace(/\//g, '_')
	.replace(/=+$/, '');

// Export private key in PKCS8 format (for Web Crypto API import)
const privateKeyPkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' });
const privateKeyBase64Url = Buffer.from(privateKeyPkcs8)
	.toString('base64')
	.replace(/\+/g, '-')
	.replace(/\//g, '_')
	.replace(/=+$/, '');

console.log('='.repeat(60));
console.log('VAPID Keys Generated');
console.log('='.repeat(60));
console.log();
console.log('VAPID_PUBLIC_KEY:');
console.log(publicKeyBase64Url);
console.log();
console.log('VAPID_PRIVATE_KEY:');
console.log(privateKeyBase64Url);
console.log();
console.log('='.repeat(60));
console.log('Commands to set secrets:');
console.log('='.repeat(60));
console.log();
console.log('# Main app (production):');
console.log(`echo "${publicKeyBase64Url}" | wrangler secret put VAPID_PUBLIC_KEY`);
console.log(`echo "${privateKeyBase64Url}" | wrangler secret put VAPID_PRIVATE_KEY`);
console.log();
console.log('# Notification worker:');
console.log(
	`echo "${publicKeyBase64Url}" | wrangler secret put VAPID_PUBLIC_KEY -c workers/notifications/wrangler.jsonc`,
);
console.log(
	`echo "${privateKeyBase64Url}" | wrangler secret put VAPID_PRIVATE_KEY -c workers/notifications/wrangler.jsonc`,
);
console.log();
console.log('# For local development, add to .dev.vars file:');
console.log("# (Create .dev.vars in project root if it doesn't exist)");
console.log();
console.log(`VAPID_PUBLIC_KEY=${publicKeyBase64Url}`);
console.log(`VAPID_PRIVATE_KEY=${privateKeyBase64Url}`);
console.log(`NOTIFICATIONS_WORKER_URL=http://localhost:8787`);
console.log();
