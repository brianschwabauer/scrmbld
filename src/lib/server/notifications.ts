/**
 * Server-side notification utilities for sending push notifications
 * on various app events (friend requests, etc.)
 *
 * NOTE: Achievements are awarded synchronously and shown in-game,
 * so they should NOT trigger push notifications.
 */

import { createDb } from './db';
import { pushSubscription } from './schema';
import { eq } from 'drizzle-orm';
import { sendPushNotification } from './web-push';

export type NotificationType =
	| 'friend_request'
	| 'friend_accepted'
	| 'daily_reminder'
	| 'weekly_leaderboard';

interface NotificationPayload {
	type: NotificationType;
	title: string;
	body: string;
	url?: string;
	icon?: string;
	data?: Record<string, unknown>;
}

interface NotifyUserOptions {
	d1: D1Database;
	vapidPublicKey: string;
	vapidPrivateKey: string;
}

/**
 * Send a push notification to all of a user's subscribed devices
 * Returns the number of successful sends and removes expired subscriptions
 */
export async function notifyUser(
	userId: string,
	payload: NotificationPayload,
	options: NotifyUserOptions,
): Promise<{ sent: number; failed: number; expired: number }> {
	const db = createDb(options.d1);

	// Get all push subscriptions for this user
	const subscriptions = await db
		.select()
		.from(pushSubscription)
		.where(eq(pushSubscription.userId, userId));

	if (subscriptions.length === 0) {
		return { sent: 0, failed: 0, expired: 0 };
	}

	// Filter subscriptions based on notification type preferences
	const filtered = subscriptions.filter((sub) => {
		switch (payload.type) {
			case 'friend_request':
			case 'friend_accepted':
				return sub.notifyFriendActivity !== 0;
			case 'daily_reminder':
				return sub.notifyDailyReminder !== 0;
			case 'weekly_leaderboard':
				return sub.notifyWeeklyRecap !== 0;
			default:
				return true;
		}
	});

	if (filtered.length === 0) {
		return { sent: 0, failed: 0, expired: 0 };
	}

	let sent = 0;
	let failed = 0;
	const expiredIds: string[] = [];

	for (const sub of filtered) {
		const result = await sendPushNotification(
			{
				endpoint: sub.endpoint,
				p256dh: sub.p256dh,
				auth: sub.auth,
			},
			{
				title: payload.title,
				body: payload.body,
				url: payload.url,
				icon: payload.icon,
				// Include type and extra data for the service worker
				...({ type: payload.type, data: payload.data } as Record<string, unknown>),
			},
			{
				vapidPublicKey: options.vapidPublicKey,
				vapidPrivateKey: options.vapidPrivateKey,
				vapidSubject: 'mailto:notifications@scrmbld.app',
			},
		);

		if (result.success) {
			sent++;
		} else if (result.statusCode === 410 || result.statusCode === 404) {
			// Subscription expired, mark for deletion
			expiredIds.push(sub.id);
		} else {
			failed++;
		}
	}

	// Clean up expired subscriptions
	if (expiredIds.length > 0) {
		for (const id of expiredIds) {
			await db.delete(pushSubscription).where(eq(pushSubscription.id, id));
		}
	}

	return { sent, failed, expired: expiredIds.length };
}

/**
 * Send a friend request notification
 */
export async function notifyFriendRequest(
	recipientUserId: string,
	senderName: string,
	senderUsername: string | null | undefined,
	options: NotifyUserOptions,
): Promise<void> {
	const displayName = senderName || senderUsername || 'Someone';

	await notifyUser(
		recipientUserId,
		{
			type: 'friend_request',
			title: 'New Friend Request',
			body: `${displayName} wants to be your friend!`,
			url: '/friends',
		},
		options,
	);
}

/**
 * Send a friend accepted notification
 */
export async function notifyFriendAccepted(
	originalSenderUserId: string,
	accepterName: string,
	accepterUsername: string | null | undefined,
	options: NotifyUserOptions,
): Promise<void> {
	const displayName = accepterName || accepterUsername || 'Someone';

	await notifyUser(
		originalSenderUserId,
		{
			type: 'friend_accepted',
			title: 'Friend Request Accepted',
			body: `${displayName} accepted your friend request!`,
			url: '/friends',
		},
		options,
	);
}
