/* eslint-disable @typescript-eslint/no-use-before-define */
import { getConnection, logBeforeTimeout } from '@firestone-hs/aws-lambda-utils';
import { ServerlessMysql } from 'serverless-mysql';
import { handleGameEndEvent } from './events/game-end-event';
import { handleGameStartBgsEvent } from './events/game-start-bgs-event';
import { handleGameStartEvent } from './events/game-start-event';
import { handleGameStartMercsEvent } from './events/game-start-mercs-event';
import { GameStartBgsEvent, GameStartEvent, GameStartMercsEvent, PresenceEvent } from './sqs-event';

// let allCards: AllCardsService;

export default async (event, context): Promise<any> => {
	const cleanup = logBeforeTimeout(context);
	const events: readonly PresenceEvent[] = (event.Records as any[])
		.map((event) => JSON.parse(event.body))
		.reduce((a, b) => a.concat(b), []);
	const mysql = await getConnection();
	for (const ev of events) {
		await processEvent(ev, mysql);
	}
	await mysql.end();
	cleanup();

	const response = {
		statusCode: 200,
		isBase64Encoded: false,
		body: null,
	};
	return response;
};

const processEvent = async (input: PresenceEvent, mysql: ServerlessMysql) => {
	switch (input.type) {
		case 'game-start':
			return await handleGameStartEvent(input as GameStartEvent, mysql);
		case 'game-start-bgs':
			return await handleGameStartBgsEvent(input as GameStartBgsEvent, mysql);
		case 'game-start-mercs':
			return await handleGameStartMercsEvent(input as GameStartMercsEvent, mysql);
		case 'game-end':
			return await handleGameEndEvent(input as GameStartEvent, mysql);
	}
};
