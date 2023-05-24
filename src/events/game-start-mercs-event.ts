import { runQuery } from '@firestone-hs/aws-lambda-utils';
import { ServerlessMysql } from 'serverless-mysql';
import SqlString from 'sqlstring';
import { GameStartMercsEvent } from '../sqs-event';
import { ensureEntryExists } from './common';

export const handleGameStartMercsEvent = async (event: GameStartMercsEvent, mysql: ServerlessMysql) => {
	await ensureEntryExists(event.user, mysql);
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
                playerRank = ${SqlString.escape(event.data.mmrAtStart)},
                playerCardId = ${SqlString.escape(null)},
                opponentCardId = ${SqlString.escape(null)}
            WHERE userId = ${SqlString.escape(event.user.userId)}
        `,
		true,
	);
};
