import { runQuery } from '@firestone-hs/aws-lambda-utils';
import { GameFormat, GameType } from '@firestone-hs/reference-data';
import { ServerlessMysql } from 'serverless-mysql';
import SqlString from 'sqlstring';
import { GameStartEvent, Rank } from '../sqs-event';
import { ensureEntryExists } from './common';

export const handleGameStartEvent = async (event: GameStartEvent, mysql: ServerlessMysql) => {
	await ensureEntryExists(event.user, mysql);
	const rankInfo = buildRankInfo(event);
	await runQuery(
		mysql,
		`
            UPDATE twitch_presence
            SET 
                lastUpdateDate = ${SqlString.escape(new Date())},
                gameStatus = 'ongoing',
                formatType = ${SqlString.escape(event.data.metadata.formatType)},
                gameType = ${SqlString.escape(event.data.metadata.gameType)},
                scenarioId = ${SqlString.escape(event.data.metadata.scenarioId)},
                playerRank = ${SqlString.escape(rankInfo)},
                playerCardId = ${SqlString.escape(event.data.playerCardId)},
                opponentCardId = ${SqlString.escape(event.data.opponentCardId)}
            WHERE userId = ${SqlString.escape(event.user.userId)}
        `,
		true,
	);
};

const buildRankInfo = (event: GameStartEvent): string => {
	if (event.data.playerRank) {
		return event.data.playerRank;
	}
	switch (event.data.metadata.gameType) {
		case GameType.GT_RANKED:
			switch (event.data.metadata.formatType) {
				case GameFormat.FT_WILD:
					return extractRankInfo(event.data.matchInfo?.localPlayer?.wild);
				case GameFormat.FT_CLASSIC:
					return extractRankInfo(event.data.matchInfo?.localPlayer?.classic);
				case GameFormat.FT_TWIST:
					return extractRankInfo(event.data.matchInfo?.localPlayer?.twist);
				default:
					return extractRankInfo(event.data.matchInfo?.localPlayer?.standard);
			}
	}
};

const extractRankInfo = (rank: Rank): string => {
	if (!rank) {
		return null;
	}

	if (rank.legendRank > 0) {
		return `legend-${rank.legendRank}`;
	} else if (rank.leagueId >= 0 && rank.rankValue >= 0) {
		return `${rank.leagueId}-${rank.rankValue}`;
	}
	return null;
};
