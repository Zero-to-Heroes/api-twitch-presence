import { Board, GameFormat, GameType } from '@firestone-hs/reference-data';

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface PresenceEvent {
	readonly type: 'game-start' | 'game-start-bgs' | 'game-start-mercs' | 'game-end';
	readonly user: UserInfo;
}

export interface GameStartEvent extends PresenceEvent {
	readonly type: 'game-start';
	readonly data: {
		readonly matchInfo?: MatchInfo;
		readonly playerRank?: string;
		readonly playerClass: string;
		readonly playerCardId: string;
		readonly opponentClass: string;
		readonly opponentCardId: string;
		readonly metadata: {
			readonly gameType: GameType;
			readonly formatType: GameFormat;
			readonly scenarioId: number;
		};
	};
}

export interface GameStartBgsEvent extends PresenceEvent {
	readonly type: 'game-start-bgs';
	readonly data: {
		readonly playerCardId: string;
		readonly mmrAtStart: number;
		readonly metadata: {
			readonly gameType: GameType;
			readonly formatType: GameFormat;
			readonly scenarioId: number;
		};
	};
}

export interface GameStartMercsEvent extends PresenceEvent {
	readonly type: 'game-start-mercs';
	readonly data: {
		readonly mmrAtStart: number;
		readonly mercenaries: readonly string[];
		readonly metadata: {
			readonly gameType: GameType;
			readonly formatType: GameFormat;
			readonly scenarioId: number;
		};
	};
}

export interface GameEndEvent extends PresenceEvent {
	readonly type: 'game-end';
}

export interface UserInfo {
	readonly userId: string;
	readonly userName: string;
	readonly twitchUserName: string;
}

export interface MatchInfo {
	readonly localPlayer: PlayerInfo;
	readonly opponent: PlayerInfo;
	readonly boardId: Board;
}

export interface PlayerInfo {
	readonly name: string;
	readonly cardBackId: number;
	readonly standard: Rank;
	readonly wild: Rank;
	readonly classic: Rank;
}

export interface Rank {
	readonly leagueId: number;
	readonly rankValue: number;
	readonly legendRank: number;
}
