import { GameFormat, GameType } from '@firestone-hs/reference-data';

export interface PresenceResult {
	readonly streams: readonly PresenceInfo[];
	readonly lastUpdateDate: Date;
}

// https://dev.twitch.tv/docs/api/reference#get-streams
export interface TwitchInfo {
	readonly twitchUserName: string;
	// readonly id: string;
	readonly user_id: string;
	readonly user_login: string;
	readonly user_name: string;
	readonly game_id: string;
	readonly type: string;
	readonly title: string;
	readonly viewer_count: number;
	readonly started_at: string;
	readonly language: string;
	readonly thumbnail_url: string;
	readonly is_mature: string;
}

export interface InternalDbRow {
	readonly id: number;
	readonly userId: string;
	readonly userName: string;
	readonly twitchUserName: string;
	readonly lastUpdateDate: Date;
	readonly gameStatus: string;
	readonly formatType: GameFormat;
	readonly gameType: GameType;
	readonly scenarioId: number;
	readonly playerRank: string;
	readonly playerCardId: string;
	readonly opponentCardId: string;
}

export interface PresenceInfo extends InternalDbRow, TwitchInfo {}
