// Achievement definitions - shared between client and server

export interface AchievementDef {
	id: string;
	name: string;
	description: string;
	icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
	{
		id: 'speed_demon',
		name: 'Speed Demon',
		description: 'Solve in under 30 seconds',
		icon: '\u26A1', // ⚡
	},
	{
		id: 'lightning',
		name: 'Lightning',
		description: 'Solve in under 15 seconds',
		icon: '\u{1F525}', // 🔥
	},
	{
		id: 'no_hints',
		name: 'Pure Skill',
		description: 'Solve without using any hints',
		icon: '\u{1F9E0}', // 🧠
	},
	{
		id: 'streak_7',
		name: 'Week Warrior',
		description: 'Maintain a 7-day streak',
		icon: '\u{1F4AA}', // 💪
	},
	{
		id: 'streak_30',
		name: 'Monthly Master',
		description: 'Maintain a 30-day streak',
		icon: '\u{1F3C6}', // 🏆
	},
	{
		id: 'streak_100',
		name: 'Century Club',
		description: 'Maintain a 100-day streak',
		icon: '\u{1F451}', // 👑
	},
	{
		id: 'early_bird',
		name: 'Early Bird',
		description: 'Solve before 6 AM',
		icon: '\u{1F305}', // 🌅
	},
	{
		id: 'dedicated_50',
		name: 'Dedicated',
		description: 'Complete 50 games',
		icon: '\u2B50', // ⭐
	},
	{
		id: 'veteran_200',
		name: 'Veteran',
		description: 'Complete 200 games',
		icon: '\u{1F396}', // 🎖️
	},
	{
		id: 'leaderboard_king',
		name: 'Leaderboard King',
		description: 'Rank #1 among friends in a weekly leaderboard',
		icon: '\u{1F947}', // 🥇
	},
	{
		id: 'speed_king',
		name: 'Speed King',
		description: 'Fastest single solve among friends in a week',
		icon: '\u{1F3CE}', // 🏎️
	},
];

// Map for quick lookup
export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
	ACHIEVEMENTS.map((a) => [a.id, a]),
);
