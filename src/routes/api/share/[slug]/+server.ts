import type { RequestHandler } from './$types';
import satori from 'satori';
import { Resvg } from '@cf-wasm/resvg';

export const GET: RequestHandler = async ({ params, platform, url }) => {
	if (!platform?.env?.D1) {
		return new Response('Database unavailable', { status: 500 });
	}

	// Parse slug: gameplay_id.svg or gameplay_id.png
	const slug = params.slug;
	const match = slug.match(/^(.+)\.(svg|png)$/);
	if (!match) {
		return new Response('Invalid format. Use .svg or .png extension', { status: 400 });
	}

	const [, gameplayId, format] = match;

	// Fetch gameplay data
	const d1 = platform.env.D1;
	const gameplayResult = await d1
		.prepare(`SELECT uuid, word, user_id, day, time, num_hints FROM gameplay WHERE uuid = ?`)
		.bind(gameplayId)
		.first<{
			uuid: string;
			word: string;
			user_id: string | null;
			day: number;
			time: number | null;
			num_hints: number | null;
		}>();

	if (!gameplayResult || gameplayResult.time === null) {
		return new Response('Game not found or not completed', { status: 404 });
	}

	// Calculate streak if user exists
	let streak = 0;
	if (gameplayResult.user_id) {
		const streakResult = await d1
			.prepare(
				`SELECT day FROM gameplay
				 WHERE user_id = ? AND time IS NOT NULL AND day <= ?
				 ORDER BY day DESC
				 LIMIT 100`,
			)
			.bind(gameplayResult.user_id, gameplayResult.day)
			.all<{ day: number }>();

		if (streakResult.results?.length) {
			const days = [...new Set(streakResult.results.map((r) => r.day))].sort((a, b) => b - a);
			const msPerDay = 86400000;
			streak = 1;
			for (let i = 1; i < days.length; i++) {
				if (days[i - 1] - days[i] === msPerDay) {
					streak++;
				} else {
					break;
				}
			}
		}
	}

	// Format time
	const timeMs = Number(gameplayResult.time);
	const timeSec = Math.round(timeMs / 1000);
	const minutes = Math.floor(timeSec / 60);
	const seconds = timeSec % 60;
	const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

	// Format date
	const dateObj = new Date(gameplayResult.day);
	const dateDisplay = dateObj.toLocaleDateString('en-US', {
		timeZone: 'UTC',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});

	const numHints = gameplayResult.num_hints || 0;

	// Load font - use fetch to get the font from static assets
	const fontUrl = new URL('/fonts/RobotoMono-Regular.ttf', url.origin);
	const fontResponse = await fetch(fontUrl);
	const fontData = await fontResponse.arrayBuffer();

	// Create the image element tree for satori
	const width = 1200;
	const height = 630;

	const element = {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				width: '100%',
				height: '100%',
				backgroundColor: '#1a1a1a',
				fontFamily: 'Roboto Mono',
				color: '#ffffff',
			},
			children: [
				// SCRMBLD logo
				{
					type: 'div',
					props: {
						style: {
							fontSize: '48px',
							fontWeight: 700,
							color: '#02cfb7',
							letterSpacing: '8px',
							marginBottom: '24px',
						},
						children: 'SCRMBLD',
					},
				},
				// Time display
				{
					type: 'div',
					props: {
						style: {
							fontSize: '120px',
							fontWeight: 700,
							color: '#ffffff',
							marginBottom: '16px',
						},
						children: timeDisplay,
					},
				},
				// Hints used (if any)
				numHints > 0
					? {
							type: 'div',
							props: {
								style: {
									fontSize: '24px',
									color: '#888888',
									marginBottom: '24px',
								},
								children: `${numHints} hint${numHints === 1 ? '' : 's'} used`,
							},
						}
					: null,
				// Streak (if any)
				streak > 0
					? {
							type: 'div',
							props: {
								style: {
									display: 'flex',
									alignItems: 'center',
									fontSize: '32px',
									color: '#ff9632',
									marginBottom: '24px',
								},
								children: `${streak} day streak`,
							},
						}
					: null,
				// Date
				{
					type: 'div',
					props: {
						style: {
							fontSize: '20px',
							color: '#666666',
							marginTop: '16px',
						},
						children: dateDisplay,
					},
				},
				// URL
				{
					type: 'div',
					props: {
						style: {
							fontSize: '18px',
							color: '#444444',
							marginTop: '32px',
						},
						children: 'scrmbld.app',
					},
				},
			].filter(Boolean),
		},
	};

	// Generate SVG with satori
	const svg = await satori(element, {
		width,
		height,
		fonts: [
			{
				name: 'Roboto Mono',
				data: fontData,
				weight: 400,
				style: 'normal',
			},
			{
				name: 'Roboto Mono',
				data: fontData,
				weight: 700,
				style: 'normal',
			},
		],
	});

	// Return SVG or PNG based on format
	if (format === 'svg') {
		return new Response(svg, {
			headers: {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		});
	}

	// Convert to PNG using resvg (WASM is bundled via @cf-wasm/resvg)
	const resvg = await Resvg.async(svg, {
		fitTo: {
			mode: 'width',
			value: width,
		},
	});
	const pngData = resvg.render();
	const pngBuffer = pngData.asPng();

	return new Response(pngBuffer, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
};
