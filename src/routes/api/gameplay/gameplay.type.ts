export interface GamePlay {
	/** The database id of the gameplay entry */
	id: number;

	/** The generated UUID of the game play */
	uuid: string;

	/** The epoch timestamp (in UTC ms) of the canonical day that the game was played */
	day: number;

	/** The word that was played. This should always be the same for every player on the say 'day' */
	word: string;

	/** The UUID of the user that played the game */
	user_uuid: string;

	/** The epoch timestamp in ms when the game started */
	started_at: number;

	/** The epoch timestamp in ms when the game ended */
	ended_at?: number;

	/** The total duration in ms that it took to finish the game. Doesn't count breaks */
	time?: number;

	/** The number of hints used by the user to finish the game */
	num_hints?: number;

	/** The start/stop times that the user played the game. A game can be paused by closing the browser */
	json?: { times?: [number, number][] };

	/** The IP address of the user */
	ip?: string;

	/** The city of the user's IP address */
	ip_city?: string;

	/** The country of the user's IP address **/
	ip_country?: string;

	/** The latitude of the user's IP address */
	ip_latitude?: string;

	/** The longitude of the user's IP address */
	ip_longitude?: string;

	/** The region of the user's IP address */
	ip_region?: string;

	/** The timezone of the user's IP address */
	ip_timezone?: string;

	/** The user's 'agent' string */
	ua?: string;

	/** The browser the user used */
	ua_browser?: string;

	/** The browser version the user used */
	ua_os?: string;

	/** The operating system the user used */
	ua_device?: string;
}

export type GamePlayUpdate = Partial<Pick<GamePlay, 'day' | 'word' | 'ended_at'>>;
