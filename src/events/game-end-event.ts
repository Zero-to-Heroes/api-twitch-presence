import { runQuery } from '@firestone-hs/aws-lambda-utils';
import { ServerlessMysql } from 'serverless-mysql';
import SqlString from 'sqlstring';
import { GameStartEvent } from '../sqs-event';
import { ensureEntryExists } from './common';

export const handleGameEndEvent = async (event: GameStartEvent, mysql: ServerlessMysql) => {
	await ensureEntryExists(event.user, mysql);
	await runQuery(
		mysql,
		`
			UPDATE twitch_presence
			SET 
				lastUpdateDate = ${SqlString.escape(new Date())},
				gameStatus = 'ended'
			WHERE userId = ${SqlString.escape(event.user.userId)}
		`,
		true,
	);
};
