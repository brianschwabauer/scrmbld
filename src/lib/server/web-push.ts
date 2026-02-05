/**
 * Workers-compatible Web Push implementation
 * Uses Web Crypto API for VAPID signing and payload encryption
 */

interface PushSubscription {
	endpoint: string;
	p256dh: string;
	auth: string;
}

interface PushOptions {
	vapidPublicKey: string;
	vapidPrivateKey: string;
	vapidSubject: string;
	ttl?: number;
}

interface PushPayload {
	title: string;
	body: string;
	url?: string;
	icon?: string;
	type?: string;
	data?: Record<string, unknown>;
}

// Base64url encoding/decoding utilities
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
	const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const binaryString = atob(base64 + padding);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatArrayBuffers(...buffers: (ArrayBuffer | Uint8Array)[]): ArrayBuffer {
	const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const buf of buffers) {
		const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
		result.set(bytes, offset);
		offset += buf.byteLength;
	}
	return result.buffer as ArrayBuffer;
}

// Create VAPID JWT
async function createVapidJwt(
	audience: string,
	subject: string,
	privateKeyBase64: string,
	publicKeyBase64: string,
): Promise<string> {
	const header = {
		typ: 'JWT',
		alg: 'ES256',
	};

	const now = Math.floor(Date.now() / 1000);
	const payload = {
		aud: audience,
		exp: now + 12 * 60 * 60, // 12 hours
		sub: subject,
	};

	const headerB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
	const payloadB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
	const unsignedToken = `${headerB64}.${payloadB64}`;

	// Import the private key
	const privateKeyRaw = base64UrlToArrayBuffer(privateKeyBase64);
	const privateKey = await crypto.subtle.importKey(
		'pkcs8',
		privateKeyRaw,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign'],
	);

	// Sign
	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		privateKey,
		new TextEncoder().encode(unsignedToken),
	);

	// Convert DER signature to raw format (r || s)
	const sigBytes = new Uint8Array(signature);
	let rawSig: Uint8Array;
	if (sigBytes.length === 64) {
		rawSig = sigBytes;
	} else {
		// DER format - need to extract r and s
		rawSig = new Uint8Array(64);
		// This is simplified - in practice DER parsing is more complex
		// but Web Crypto usually returns raw format for ECDSA P-256
		rawSig.set(sigBytes.slice(0, 32), 0);
		rawSig.set(sigBytes.slice(32, 64), 32);
	}

	return `${unsignedToken}.${arrayBufferToBase64Url(rawSig)}`;
}

// Encrypt push payload according to RFC 8291
async function encryptPayload(
	payload: string,
	p256dhBase64: string,
	authBase64: string,
): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; localPublicKey: ArrayBuffer }> {
	// Generate local key pair
	const localKeyPair = await crypto.subtle.generateKey(
		{ name: 'ECDH', namedCurve: 'P-256' },
		true,
		['deriveBits'],
	);

	// Export local public key
	const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);

	// Import subscriber's public key
	const p256dhBuffer = base64UrlToArrayBuffer(p256dhBase64);
	const subscriberPublicKey = await crypto.subtle.importKey(
		'raw',
		p256dhBuffer,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[],
	);

	// Derive shared secret via ECDH
	const sharedSecret = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: subscriberPublicKey },
		localKeyPair.privateKey,
		256,
	);

	// Get auth secret
	const authSecret = base64UrlToArrayBuffer(authBase64);

	// RFC 8291: Derive IKM using HKDF
	// IKM = ECDH shared secret, salt = auth secret
	// info = "WebPush: info\0" || ua_public (65 bytes) || as_public (65 bytes)
	const ikm = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
	const ikmInfo = concatArrayBuffers(
		new TextEncoder().encode('WebPush: info\0'),
		p256dhBuffer,
		localPublicKeyRaw,
	);

	const prk = await crypto.subtle.deriveBits(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: new Uint8Array(authSecret),
			info: new Uint8Array(ikmInfo),
		},
		ikm,
		256,
	);

	// Generate random content salt
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// Derive content encryption key (CEK) — 16 bytes
	const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
	const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');

	const cek = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt: salt, info: cekInfo },
		prkKey,
		128,
	);

	// Derive nonce — 12 bytes (separate HKDF with different info)
	const nonceKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
	const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

	const nonce = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt: salt, info: nonceInfo },
		nonceKey,
		96,
	);

	// Import content encryption key
	const aesKey = await crypto.subtle.importKey('raw', new Uint8Array(cek), 'AES-GCM', false, [
		'encrypt',
	]);

	// Pad the payload (add delimiter byte 0x02 and padding)
	const payloadBytes = new TextEncoder().encode(payload);
	const paddedPayload = new Uint8Array(payloadBytes.length + 1);
	paddedPayload.set(payloadBytes);
	paddedPayload[payloadBytes.length] = 0x02; // delimiter

	// Encrypt
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: new Uint8Array(nonce) },
		aesKey,
		paddedPayload,
	);

	// Build the final encrypted content
	// Format: salt (16) + record size (4) + key length (1) + key + ciphertext
	const recordSize = 4096;
	const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.byteLength);
	header.set(salt, 0);
	new DataView(header.buffer).setUint32(16, recordSize, false);
	header[20] = localPublicKeyRaw.byteLength;
	header.set(new Uint8Array(localPublicKeyRaw), 21);

	const finalEncrypted = concatArrayBuffers(header.buffer, encrypted);

	return {
		encrypted: finalEncrypted,
		salt,
		localPublicKey: localPublicKeyRaw,
	};
}

/**
 * Send a push notification
 * Returns true if successful, false if the subscription is invalid (410 Gone)
 */
export async function sendPushNotification(
	subscription: PushSubscription,
	payload: PushPayload,
	options: PushOptions,
): Promise<{ success: boolean; statusCode: number; error?: string }> {
	try {
		const payloadString = JSON.stringify(payload);

		// Encrypt the payload
		const { encrypted } = await encryptPayload(
			payloadString,
			subscription.p256dh,
			subscription.auth,
		);

		// Parse endpoint to get audience
		const endpointUrl = new URL(subscription.endpoint);
		const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

		// Create VAPID JWT
		const jwt = await createVapidJwt(
			audience,
			options.vapidSubject,
			options.vapidPrivateKey,
			options.vapidPublicKey,
		);

		// Send the push message
		const response = await fetch(subscription.endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Encoding': 'aes128gcm',
				'Content-Length': encrypted.byteLength.toString(),
				TTL: (options.ttl || 86400).toString(),
				Authorization: `vapid t=${jwt}, k=${options.vapidPublicKey}`,
			},
			body: encrypted,
		});

		if (response.ok || response.status === 201) {
			return { success: true, statusCode: response.status };
		}

		// 410 Gone means the subscription is no longer valid
		if (response.status === 410 || response.status === 404) {
			return { success: false, statusCode: response.status, error: 'Subscription expired' };
		}

		const errorText = await response.text();
		return { success: false, statusCode: response.status, error: errorText };
	} catch (error) {
		return {
			success: false,
			statusCode: 500,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
