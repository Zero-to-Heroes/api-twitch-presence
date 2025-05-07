import { getConnectionProxy, groupByFunction, http, logBeforeTimeout, runQuery } from '@firestone-hs/aws-lambda-utils';
import { SecretsManager } from 'aws-sdk';
import { GetSecretValueRequest, GetSecretValueResponse } from 'aws-sdk/clients/secretsmanager';
import { URLSearchParams } from 'url';
import { gzipSync } from 'zlib';
import { InternalDbRow, PresenceInfo, PresenceResult, TwitchInfo } from './model';
import { chunk } from './utils';

const secretsManager = new SecretsManager({ region: 'us-west-2' });

const CACHE_DURATION = 1 * 60 * 1000;
let cachedResult = null;
let lastUpdateDate: number | null = null;

export default async (event, context): Promise<any> => {
	if (cachedResult && Date.now() - lastUpdateDate < CACHE_DURATION) {
		return {
			statusCode: 200,
			isBase64Encoded: true,
			body: cachedResult,
			headers: {
				'Content-Type': 'application/json',
				'Content-Encoding': 'gzip',
			},
		};
	}

	console.log('retrieving twitch presence to repopulate cache', Date.now() - lastUpdateDate);
	const cleanup = logBeforeTimeout(context);
	const mysql = await getConnectionProxy();
	const dbData: readonly InternalDbRow[] = await runQuery(
		mysql,
		`
            SELECT * FROM twitch_presence
        `,
		false,
	);
	await mysql.end();

	const userNameRegex = /^[a-z0-9_]+$/i;
	dbData.forEach((r) => {
		if (!r.twitchUserName?.match(userNameRegex)) {
			// console.log('invalid userName', r.twitchUserName);
		}
	});
	const validDbData = dbData.filter((r) => r.twitchUserName?.match(userNameRegex));
	// console.log('all valid twitch user names', JSON.stringify(validDbData.map((r) => r.twitchUserName)));
	const groupedByStreamer = groupByFunction((r: InternalDbRow) => r.twitchUserName)(validDbData);
	const latestStreamerData = Object.values(groupedByStreamer).map(
		(r) => [...r].sort((a, b) => b.lastUpdateDate?.getTime() - a.lastUpdateDate?.getTime())[0],
	);
	// console.log('latest streamer data', latestStreamerData);

	const secretRequest: GetSecretValueRequest = {
		SecretId: 'twitch',
	};
	const secret: SecretInfo = await getSecret(secretRequest);
	const twitchInfo = await getTwitchInfo(
		latestStreamerData.map((r) => r.twitchUserName),
		secret,
	);
	// console.log('twitch info', twitchInfo);
	// const inDbButNotStreaming = latestStreamerData
	// 	.filter((d) => !twitchInfo.some((t) => t.user_login === d.twitchUserName))
	// 	.map((info) => info.twitchUserName);
	// console.log('in db, but not streaming', inDbButNotStreaming);

	const mergedResult: readonly PresenceInfo[] = mergeInfos(latestStreamerData, twitchInfo);
	const result: PresenceResult = {
		streams: mergedResult,
		lastUpdateDate: new Date(),
	};

	const stringResults = JSON.stringify(result);
	const gzippedResults = gzipSync(stringResults).toString('base64');

	cachedResult = gzippedResults;
	lastUpdateDate = Date.now();

	const response = {
		statusCode: 200,
		isBase64Encoded: true,
		body: gzippedResults,
		headers: {
			'Content-Type': 'application/json',
			'Content-Encoding': 'gzip',
		},
	};
	cleanup();
	return response;
};

const mergeInfos = (dbInfos: readonly InternalDbRow[], twitchInfos: readonly TwitchInfo[]): readonly PresenceInfo[] => {
	const relevantDbInfos = dbInfos.filter((info) => {
		const isOk =
			info.gameStatus === 'ongoing' && Date.now() - new Date(info.lastUpdateDate).getTime() < 15 * 60 * 1000;
		// console.debug(
		// 	'is valid?',
		// 	info.twitchUserName,
		// 	info.gameStatus,
		// 	info.lastUpdateDate,
		// 	Date.now() - new Date(info.lastUpdateDate).getTime() < 5 * 60 * 1000,
		// 	Date.now() - new Date(info.lastUpdateDate).getTime(),
		// 	Date.now(),
		// 	new Date(info.lastUpdateDate).getTime(),
		// );
		// if (!isOk) {
		// }
		return isOk;
	});
	// console.log(
	// 	'relevant db infos',
	// 	relevantDbInfos.map((info) => info.twitchUserName),
	// );
	return twitchInfos
		.map((twitchInfo) => {
			const dbInfo = relevantDbInfos.find(
				// Backward compatibility
				(info) => info.twitchUserName === twitchInfo.user_login || info.twitchUserName === twitchInfo.user_name,
			);

			if (!dbInfo) {
				// console.debug('missing dbInfo', twitchInfo.user_login, twitchInfo);
				return null;
			}

			return {
				...twitchInfo,
				twitchUserName: dbInfo.twitchUserName,
				lastUpdateDate: dbInfo.lastUpdateDate,
				gameStatus: dbInfo.gameStatus,
				formatType: dbInfo.formatType,
				gameType: dbInfo.gameType,
				scenarioId: dbInfo.scenarioId,
				playerRank: dbInfo.playerRank,
				playerCardId: dbInfo.playerCardId,
				opponentCardId: dbInfo.opponentCardId,
			};
		})
		.filter((info) => !!info);
};

const getTwitchInfo = async (
	twitchUserNames: readonly string[],
	secret: SecretInfo,
): Promise<readonly TwitchInfo[]> => {
	// console.debug('getting info for usernames', twitchUserNames);
	const accessToken = await getTwitchAccessToken(secret);
	const streamInfos = await getStreamsInfo(twitchUserNames, accessToken, secret.client_id);
	return streamInfos.filter((info) => info.game_id === '138585');
};

const getStreamsInfo = async (
	twitchUserNames: readonly string[],
	accessToken: string,
	clientId: string,
): Promise<readonly TwitchInfo[]> => {
	const listSize = 100;
	const chunks = chunk(twitchUserNames, listSize);
	const result: TwitchInfo[] = [];
	for (const chunk of chunks) {
		// TODO: chunnk the logins (limited to 100) and handle pagination
		const userLogins = chunk.map((name) => `user_login=${name}`).join('&');
		const url = `https://api.twitch.tv/helix/streams?first=${listSize}&${userLogins}`;
		// console.log('calling URL', url);
		const streamsResponseStr = await http(url, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Client-Id': clientId,
			},
		});
		// console.debug('streamsResponseStr', streamsResponseStr);
		const streamsResponse = JSON.parse(streamsResponseStr)?.data ?? [];
		// console.debug('stream response', streamsResponse, JSON.parse(streamsResponseStr)?.data);
		result.push(...streamsResponse);
	}
	return result;
};

const getTwitchAccessToken = async (secret: SecretInfo): Promise<string> => {
	// FIXME: extract this to the secret manager
	const details = {
		client_id: secret.client_id,
		client_secret: secret.client_secret,
		grant_type: 'client_credentials',
	};
	const twitchResponse = await http('https://id.twitch.tv/oauth2/token', {
		method: 'POST',
		body: new URLSearchParams(details),
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	});
	const accessToken = JSON.parse(twitchResponse)?.access_token;
	// console.log('twitchResponse', accessToken, twitchResponse);
	return accessToken;
};

const getSecret = (secretRequest: GetSecretValueRequest) => {
	return new Promise<SecretInfo>((resolve) => {
		secretsManager.getSecretValue(secretRequest, (err, data: GetSecretValueResponse) => {
			const secretInfo: SecretInfo = JSON.parse(data.SecretString);
			resolve(secretInfo);
		});
	});
};

interface SecretInfo {
	readonly client_id: string;
	readonly client_secret: string;
}
