import { runQuery } from '@firestone-hs/aws-lambda-utils';
import { ServerlessMysql } from 'serverless-mysql';
import SqlString from 'sqlstring';
import { UserInfo } from '../sqs-event';

export const ensureEntryExists = async (user: UserInfo, mysql: ServerlessMysql) => {
	const result: any[] = await runQuery(
		mysql,
		`
            SELECT * FROM twitch_presence
            WHERE userId = ${SqlString.escape(user.userId)} OR userName = ${SqlString.escape(user.userName)}
        `,
		true,
	);
	if (!result.length) {
		await runQuery(
			mysql,
			`
                INSERT INTO twitch_presence
                (userId, userName)
                VALUES (${SqlString.escape(user.userId)}, ${SqlString.escape(user.userName)})
            `,
			true,
		);
	}
	// Make sure the data always reflects the latest user info (userId can change after a reinstall)
	await runQuery(
		mysql,
		`
            UPDATE twitch_presence
            SET 
                userId = ${SqlString.escape(user.userId)}, 
                userName = ${SqlString.escape(user.userName)},
                twitchUserName = ${SqlString.escape(user.twitchUserName)}
            WHERE userId = ${SqlString.escape(user.userId)} OR userName = ${SqlString.escape(user.userName)}
        `,
		true,
	);
};
