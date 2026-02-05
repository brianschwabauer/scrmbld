#!/usr/bin/env bun

/**
 * Seed script for local D1 development database.
 *
 * Usage:
 *   bun scripts/seed.js
 *
 * Populates the database with realistic fake data:
 *   - 12 users (including the real "brianschwabauer" account)
 *   - Friendships between users (various states)
 *   - 30+ days of gameplay history per active user
 *   - Achievements
 *   - Push subscriptions with varying preferences
 *
 * NOTE: This script talks directly to the local SQLite file used by
 *       the preview/staging D1 environment. It does NOT touch production.
 */

import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import { readdirSync } from 'fs';
import { join } from 'path';
import WORDLIST from '../static/wordlist.json';

// ---------------------------------------------------------------------------
// Locate the local D1 database file (preview environment = scrmbld-staging)
// ---------------------------------------------------------------------------
const D1_DIR = join(
	import.meta.dirname,
	'..',
	'.wrangler',
	'state',
	'v3',
	'd1',
	'miniflare-D1DatabaseObject',
);

// The staging database ID hash — find the .sqlite file that ISN'T the
// production one. We just pick the first .sqlite that doesn't have "-shm"/"-wal" suffix.
const files = readdirSync(D1_DIR).filter((f) => f.endsWith('.sqlite'));
if (files.length === 0) {
	console.error('No local D1 database found. Run migrations first:');
	console.error('  npx wrangler d1 migrations apply scrmbld-staging --local --env preview');
	process.exit(1);
}

// If multiple .sqlite files exist, prefer the staging one (d7739850...)
// Otherwise just use the first one found.
const dbFile =
	files.find((f) => f.startsWith('d7739850')) ||
	files.find((f) => f.startsWith('74bed334')) ||
	files[0];
const dbPath = join(D1_DIR, dbFile);
console.log(`Using database: ${dbPath}`);

const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uuid() {
	return randomUUID();
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

/** Epoch seconds (Drizzle mode: 'timestamp' convention) */
function epochSec(date) {
	return Math.floor(date.getTime() / 1000);
}

/** Epoch ms for gameplay.day — UTC midnight of a date */
function dayEpoch(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).setUTCHours(0, 0, 0, 0);
}

/** Get the word for a given day epoch from the wordlist */
function getWordForDay(dayMs) {
	const firstDay = WORDLIST.firstDay;
	const list = WORDLIST.list;
	const daysSinceStart = Math.max(0, Math.floor((dayMs - firstDay) / 86400000));
	return list[daysSinceStart % list.length][0];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const NOW = new Date();
const NOW_SEC = epochSec(NOW);
const TODAY = dayEpoch(NOW);
const MS_PER_DAY = 86400000;

// Brian's real account (looked up by username from the DB)
const BRIAN_USERNAME = 'brianschwabauer';
const brianRow = db.prepare('SELECT id FROM user WHERE username = ?').get(BRIAN_USERNAME);
if (!brianRow) {
	console.error(`User "${BRIAN_USERNAME}" not found in the database.`);
	console.error('Sign in to the app first so your account exists, then re-run this script.');
	process.exit(1);
}
const BRIAN_ID = brianRow.id;

// ---------------------------------------------------------------------------
// Fake users
// ---------------------------------------------------------------------------
const FAKE_USERS = [
	{ name: 'Alex Thompson', username: 'alexthompson', email: 'alex.t@example.com' },
	{ name: 'Jamie Rivera', username: 'jamierivera', email: 'jamie.r@example.com' },
	{ name: 'Morgan Lee', username: 'morganlee22', email: 'morgan.lee@example.com' },
	{ name: 'Sam Patel', username: 'sampatel99', email: 'sam.patel@example.com' },
	{ name: 'Casey Jordan', username: 'caseyjordan', email: 'casey.j@example.com' },
	{ name: 'Taylor Kim', username: 'taylorkimm', email: 'taylor.kim@example.com' },
	{ name: 'Riley Chen', username: 'rileychen88', email: 'riley.chen@example.com' },
	{ name: 'Jordan Blake', username: 'jordanblake', email: 'jordan.b@example.com' },
	{ name: 'Quinn Murphy', username: 'quinnmurphy', email: 'quinn.m@example.com' },
	{ name: 'Drew Martinez', username: 'drewmartinez', email: 'drew.m@example.com' },
	{ name: 'Avery Scott', username: 'averyscott', email: 'avery.s@example.com' },
];

// ---------------------------------------------------------------------------
// Clear existing seed data (keep Brian's auth records)
// ---------------------------------------------------------------------------
console.log('Clearing existing data...');

// Delete everything except Brian's user/account/session records
db.exec(`DELETE FROM achievement`);
db.exec(`DELETE FROM push_subscription`);
db.exec(`DELETE FROM friendship`);
db.exec(`DELETE FROM gameplay`);
db.exec(`DELETE FROM user WHERE id != '${BRIAN_ID}'`);
db.exec(`DELETE FROM account WHERE user_id != '${BRIAN_ID}'`);
db.exec(`DELETE FROM session WHERE user_id != '${BRIAN_ID}'`);

// ---------------------------------------------------------------------------
// Create fake users + credential accounts
// ---------------------------------------------------------------------------
console.log('Creating users...');

const insertUser = db.prepare(`
	INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at, username, profile_visibility)
	VALUES (?, ?, ?, 1, NULL, ?, ?, ?, ?)
`);

const insertAccount = db.prepare(`
	INSERT INTO account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
		access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
	VALUES (?, ?, 'credential', ?, NULL, NULL, NULL, NULL, NULL, NULL,
		'$2b$10$fakehashnotarealpasswordhashbutenoughfortheseed', ?, ?)
`);

const userIds = [BRIAN_ID];

for (const u of FAKE_USERS) {
	const id = uuid().replace(/-/g, '').slice(0, 32);
	// Created 1–8 weeks ago
	const createdDaysAgo = randomInt(7, 56);
	const createdAt = epochSec(new Date(NOW.getTime() - createdDaysAgo * MS_PER_DAY));
	const visibility = Math.random() < 0.8 ? 'public' : 'friends';

	insertUser.run(id, u.name, u.email, createdAt, createdAt, u.username, visibility);
	insertAccount.run(uuid(), id, id, createdAt, createdAt);
	userIds.push(id);
}

console.log(`  Created ${FAKE_USERS.length} users`);

// ---------------------------------------------------------------------------
// Friendships
// ---------------------------------------------------------------------------
console.log('Creating friendships...');

const insertFriendship = db.prepare(`
	INSERT INTO friendship (id, user_id_1, user_id_2, status, created_at) VALUES (?, ?, ?, ?, ?)
`);

const friendshipPairs = [];

// Brian is friends with first 6 users (accepted)
for (let i = 1; i <= 6; i++) {
	const createdAt = epochSec(new Date(NOW.getTime() - randomInt(1, 30) * MS_PER_DAY));
	insertFriendship.run(uuid(), BRIAN_ID, userIds[i], 'accepted', createdAt);
	friendshipPairs.push([0, i]);
}

// 2 pending friend requests TO Brian (from users 7 and 8)
for (let i = 7; i <= 8; i++) {
	const createdAt = epochSec(new Date(NOW.getTime() - randomInt(0, 3) * MS_PER_DAY));
	insertFriendship.run(uuid(), userIds[i], BRIAN_ID, 'pending', createdAt);
}

// Brian sent a pending request to user 9
{
	const createdAt = epochSec(new Date(NOW.getTime() - randomInt(0, 2) * MS_PER_DAY));
	insertFriendship.run(uuid(), BRIAN_ID, userIds[9], 'pending', createdAt);
}

// Some friendships between other users (makes the social graph feel real)
const otherPairs = [
	[1, 2],
	[1, 3],
	[2, 4],
	[3, 5],
	[4, 6],
	[5, 7],
	[6, 8],
	[2, 9],
	[3, 10],
	[7, 11],
];
for (const [a, b] of otherPairs) {
	const createdAt = epochSec(new Date(NOW.getTime() - randomInt(3, 40) * MS_PER_DAY));
	insertFriendship.run(uuid(), userIds[a], userIds[b], 'accepted', createdAt);
	friendshipPairs.push([a, b]);
}

console.log(`  Created friendships (6 accepted, 3 pending for Brian + 10 between others)`);

// ---------------------------------------------------------------------------
// Gameplay — 45 days of history
// ---------------------------------------------------------------------------
console.log('Creating gameplay history...');

const insertGameplay = db.prepare(`
	INSERT INTO gameplay (uuid, word, user_uuid, user_id, day, started_at, ended_at, time, num_hints, json)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let gameCount = 0;
const NUM_DAYS = 45;

// Skill profiles: [avgTimeMs, stdDev, playProbability, hintProbability]
const skillProfiles = {
	fast: [18000, 6000, 0.92, 0.05],
	good: [30000, 10000, 0.85, 0.1],
	average: [50000, 15000, 0.75, 0.2],
	casual: [75000, 25000, 0.55, 0.35],
	beginner: [100000, 30000, 0.4, 0.5],
};

// Assign skill profiles to users (index 0 = Brian)
const userSkills = [
	'good', // Brian
	'fast', // Alex — the rival who's hard to beat
	'good', // Jamie
	'average', // Morgan
	'average', // Sam
	'casual', // Casey
	'good', // Taylor
	'fast', // Riley — another strong player
	'casual', // Jordan
	'beginner', // Quinn
	'average', // Drew
	'beginner', // Avery
];

for (let dayOffset = NUM_DAYS - 1; dayOffset >= 0; dayOffset--) {
	const dayMs = TODAY - dayOffset * MS_PER_DAY;
	const word = getWordForDay(dayMs);

	for (let userIdx = 0; userIdx < userIds.length; userIdx++) {
		const userId = userIds[userIdx];
		const [avgTime, stdDev, playProb, hintProb] = skillProfiles[userSkills[userIdx]];

		// Skip some days randomly based on play probability
		if (Math.random() > playProb) continue;

		// Generate a realistic solve time with some variance
		let solveTime = Math.round(avgTime + (Math.random() - 0.5) * 2 * stdDev);
		solveTime = Math.max(5000, solveTime); // Min 5 seconds

		const numHints = Math.random() < hintProb ? randomInt(1, 3) : 0;

		// Simulate time spans (1-3 segments for pauses)
		const numSegments = Math.random() < 0.15 ? randomInt(2, 3) : 1;
		const segmentTime = Math.floor(solveTime / numSegments);
		const times = [];
		let cursor = 0;
		for (let s = 0; s < numSegments; s++) {
			const start = cursor;
			const end = start + segmentTime + randomInt(-1000, 1000);
			times.push([start, Math.max(start + 1000, end)]);
			cursor = end + randomInt(2000, 30000); // pause between segments
		}

		// Started at a random time during the day
		const hourOfDay = randomInt(6, 23);
		const startedAt = dayMs + hourOfDay * 3600000 + randomInt(0, 3600000);
		const endedAt = startedAt + solveTime;

		const userUuid = `seed-${userId.slice(0, 8)}`;

		insertGameplay.run(
			uuid(),
			word,
			userUuid,
			userId,
			dayMs,
			startedAt,
			endedAt,
			solveTime,
			numHints,
			JSON.stringify({ times }),
		);
		gameCount++;
	}
}

// Add a few anonymous (no userId) games to simulate pre-signup play
for (let i = 0; i < 5; i++) {
	const dayOffset = randomInt(0, 10);
	const dayMs = TODAY - dayOffset * MS_PER_DAY;
	const word = getWordForDay(dayMs);
	const solveTime = randomInt(30000, 120000);
	const startedAt = dayMs + randomInt(6, 23) * 3600000;
	insertGameplay.run(
		uuid(),
		word,
		'anon-visitor-abc123',
		null,
		dayMs,
		startedAt,
		startedAt + solveTime,
		solveTime,
		randomInt(0, 2),
		JSON.stringify({ times: [[0, solveTime]] }),
	);
	gameCount++;
}

console.log(`  Created ${gameCount} gameplay records over ${NUM_DAYS} days`);

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------
console.log('Creating achievements...');

const insertAchievement = db.prepare(`
	INSERT OR IGNORE INTO achievement (id, user_id, achievement_id, unlocked_at) VALUES (?, ?, ?, ?)
`);

const ALL_ACHIEVEMENTS = [
	'speed_demon',
	'lightning',
	'no_hints',
	'streak_7',
	'streak_30',
	'streak_100',
	'early_bird',
	'dedicated_50',
	'veteran_200',
	'leaderboard_king',
	'speed_king',
];

// Brian: several achievements
const brianAchievements = ['speed_demon', 'no_hints', 'streak_7', 'dedicated_50', 'early_bird'];
for (const achId of brianAchievements) {
	const unlockedAt = epochSec(new Date(NOW.getTime() - randomInt(1, 30) * MS_PER_DAY));
	insertAchievement.run(uuid(), BRIAN_ID, achId, unlockedAt);
}

// Other users get various achievements based on their skill
for (let i = 1; i < userIds.length; i++) {
	const skill = userSkills[i];
	let possibleAchievements = ['no_hints'];

	if (skill === 'fast') {
		possibleAchievements = [
			'speed_demon',
			'lightning',
			'no_hints',
			'streak_7',
			'streak_30',
			'dedicated_50',
			'leaderboard_king',
			'speed_king',
		];
	} else if (skill === 'good') {
		possibleAchievements = ['speed_demon', 'no_hints', 'streak_7', 'streak_30', 'dedicated_50'];
	} else if (skill === 'average') {
		possibleAchievements = ['no_hints', 'streak_7', 'early_bird'];
	} else if (skill === 'casual') {
		possibleAchievements = ['no_hints', 'early_bird'];
	}

	// Each user unlocks a random subset
	const numToUnlock = randomInt(1, Math.min(possibleAchievements.length, 4));
	const shuffled = [...possibleAchievements].sort(() => Math.random() - 0.5);
	for (let j = 0; j < numToUnlock; j++) {
		const unlockedAt = epochSec(new Date(NOW.getTime() - randomInt(1, 40) * MS_PER_DAY));
		insertAchievement.run(uuid(), userIds[i], shuffled[j], unlockedAt);
	}
}

const achCount = db.prepare('SELECT COUNT(*) as c FROM achievement').get().c;
console.log(`  Created ${achCount} achievements`);

// ---------------------------------------------------------------------------
// Push subscriptions (fake — these won't actually send notifications)
// ---------------------------------------------------------------------------
console.log('Creating push subscriptions...');

const insertPush = db.prepare(`
	INSERT INTO push_subscription (id, user_id, endpoint, p256dh, auth, timezone,
		notify_daily_reminder, notify_friend_activity, notify_weekly_recap, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const timezones = [
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles',
	'Europe/London',
	'Europe/Berlin',
	'Asia/Tokyo',
];

// ~60% of users have push subscriptions
for (let i = 0; i < userIds.length; i++) {
	if (i !== 0 && Math.random() > 0.6) continue; // Skip Brian (index 0) — real subscription may exist
	if (i === 0) continue; // Don't create fake push sub for Brian

	const userId = userIds[i];
	const tz = randomChoice(timezones);
	const dailyReminder = Math.random() < 0.8 ? 1 : 0;
	const friendActivity = Math.random() < 0.9 ? 1 : 0;
	const weeklyRecap = Math.random() < 0.7 ? 1 : 0;
	const createdAt = epochSec(new Date(NOW.getTime() - randomInt(1, 30) * MS_PER_DAY));

	insertPush.run(
		uuid(),
		userId,
		`https://fcm.googleapis.com/fcm/send/fake-${userId.slice(0, 8)}`,
		'fake-p256dh-key-' + uuid().slice(0, 16),
		'fake-auth-' + uuid().slice(0, 8),
		tz,
		dailyReminder,
		friendActivity,
		weeklyRecap,
		createdAt,
	);
}

const pushCount = db.prepare('SELECT COUNT(*) as c FROM push_subscription').get().c;
console.log(`  Created ${pushCount} push subscriptions`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n--- Seed complete ---');
console.log(`Users:         ${db.prepare('SELECT COUNT(*) as c FROM user').get().c}`);
console.log(`Accounts:      ${db.prepare('SELECT COUNT(*) as c FROM account').get().c}`);
console.log(`Friendships:   ${db.prepare('SELECT COUNT(*) as c FROM friendship').get().c}`);
console.log(`Gameplay:      ${db.prepare('SELECT COUNT(*) as c FROM gameplay').get().c}`);
console.log(`Achievements:  ${achCount}`);
console.log(`Push subs:     ${pushCount}`);
console.log(
	`\nBrian's friends: ${db.prepare(`SELECT COUNT(*) as c FROM friendship WHERE (user_id_1 = ? OR user_id_2 = ?) AND status = 'accepted'`).get(BRIAN_ID, BRIAN_ID).c} accepted`,
);
console.log(
	`Pending requests: ${db.prepare(`SELECT COUNT(*) as c FROM friendship WHERE (user_id_1 = ? OR user_id_2 = ?) AND status = 'pending'`).get(BRIAN_ID, BRIAN_ID).c} involving Brian`,
);

db.close();
console.log('\nDone! Restart your dev server to see the changes.');
