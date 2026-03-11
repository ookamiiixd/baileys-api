import type { Connection } from "@wavvy/shared/modules/connections/schema";
import {
	type AuthenticationCreds,
	type AuthenticationState,
	initAuthCreds,
	proto,
	type SignalDataSet,
	type SignalDataTypeMap,
} from "baileys";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Effect, Either, Runtime } from "effect";
import { makeRetryPolicy } from "~/lib/retry-policy.js";
import { decode, type Encode, encode } from "../codec.js";
import * as Database from "../db/index.js";

const CREDENTIALS_NAME = "credentials";

export const make = Effect.fn("WhatsAppAuthState.make")(function* (connection: Connection) {
	const runtime = yield* Effect.runtime();
	const db = yield* Database.Database;

	const credentials = yield* Effect.gen(function* () {
		const fallback = initAuthCreds();
		const existing = yield* db.query.authStates
			.findFirst({
				where: {
					connectionId: connection.recordId,
					name: CREDENTIALS_NAME,
				},
			})
			.pipe(makeRetryPolicy(Database.retryPolicy));
		if (existing) {
			const parsed = yield* Effect.try(() => decode(existing.data)).pipe(
				Effect.catchAll((e) =>
					Effect.gen(function* () {
						yield* Effect.logError(
							"Failed to decode credentials. Falling back to default credentials. Your session may be invalidated.",
							e,
						);
						return fallback;
					}),
				),
			);

			return parsed as AuthenticationCreds;
		}

		return fallback;
	}).pipe(Effect.withSpan("WhatsAppAuthState.load"));

	const save = Effect.fn("WhatsAppAuthState.save")(function* () {
		const maybeData = yield* Effect.either(Effect.try(() => encode(credentials)));
		if (Either.isLeft(maybeData)) {
			return yield* Effect.logError(
				"Failed to encode credentials. Saving aborted.",
				maybeData.left,
			);
		}

		yield* db
			.insert(Database.tables.authStates)
			.values({
				connectionId: connection.recordId,
				name: CREDENTIALS_NAME,
				data: maybeData.right,
			})
			.onConflictDoUpdate({
				target: [Database.tables.authStates.connectionId, Database.tables.authStates.name],
				set: { data: sql`excluded.data` },
			})
			.pipe(makeRetryPolicy(Database.retryPolicy));
	});

	const reset = Effect.fn("WhatsAppAuthState.reset")(function* () {
		yield* db
			.delete(Database.tables.authStates)
			.where(eq(Database.tables.authStates.connectionId, connection.recordId))
			.pipe(makeRetryPolicy(Database.retryPolicy));
	});

	const getKeys = Effect.fn("WhatsAppAuthState.getKeys")(function* <
		T extends keyof SignalDataTypeMap,
	>(type: T, ids: string[]) {
		const rows = yield* db.query.authStates
			.findMany({
				where: {
					connectionId: connection.recordId,
					name: {
						in: ids.map((id) => `${type}-${id}`),
					},
				},
			})
			.pipe(makeRetryPolicy(Database.retryPolicy));

		const data: Record<string, SignalDataTypeMap[T]> = {};
		for (const row of rows) {
			const id = row.name.split(`${type}-`)[1];
			const maybeValue = yield* Effect.either(Effect.try(() => decode(row.data)));
			if (!id) {
				yield* Effect.logError(`Invalid auth state name format: "${row.name}". Skipping.`);
				continue;
			} else if (Either.isLeft(maybeValue)) {
				yield* Effect.logError(
					`Failed to decode auth state with name: "${row.name}". Skipping.`,
					maybeValue.left,
				);
				continue;
			}

			let value = maybeValue.right;
			if (type === "app-state-sync-key" && value) {
				value = proto.Message.AppStateSyncKeyData.fromObject(
					value as SignalDataTypeMap["app-state-sync-key"],
				) as any;
			}
			data[id] = value as SignalDataTypeMap[T];
		}

		return data;
	});

	const setKeys = Effect.fn("WhatsAppAuthState.setKeys")(function* (data: SignalDataSet) {
		const additions: {
			name: string;
			data: Encode<SignalDataTypeMap[keyof SignalDataTypeMap]>;
		}[] = [];
		const deletions: string[] = [];

		for (const category in data) {
			for (const id in data[category as keyof SignalDataTypeMap]) {
				const value = data[category as keyof SignalDataTypeMap]?.[id];
				const name = `${category}-${id}`;

				if (value) {
					const maybeEncoded = yield* Effect.either(Effect.try(() => encode(value)));
					if (Either.isLeft(maybeEncoded)) {
						yield* Effect.logError(
							`Failed to encode auth state with name: "${name}". Skipping.`,
							maybeEncoded.left,
						);
						continue;
					}

					additions.push({ name, data: maybeEncoded.right });
				} else {
					deletions.push(name);
				}
			}
		}

		if (additions.length <= 0 && deletions.length <= 0) {
			return;
		}

		yield* db
			.transaction((tx) =>
				Effect.gen(function* () {
					if (additions.length > 0) {
						yield* tx
							.insert(Database.tables.authStates)
							.values(
								additions.map((item) => ({
									connectionId: connection.recordId,
									name: item.name,
									data: item.data,
								})),
							)
							.onConflictDoUpdate({
								target: [Database.tables.authStates.connectionId, Database.tables.authStates.name],
								set: { data: sql`excluded.data` },
							});
					}

					if (deletions.length > 0) {
						yield* tx
							.delete(Database.tables.authStates)
							.where(
								and(
									eq(Database.tables.authStates.connectionId, connection.recordId),
									inArray(Database.tables.authStates.name, deletions),
								),
							);
					}
				}),
			)
			.pipe(makeRetryPolicy(Database.retryPolicy));
	});

	const state: AuthenticationState = {
		creds: credentials,
		keys: {
			get: (type, ids) => Runtime.runPromise(runtime)(getKeys(type, ids)),
			set: (data) => Runtime.runPromise(runtime)(setKeys(data)),
		},
	};

	return { state, save, reset };
});
export type WhatsAppAuthState = Effect.Effect.Success<ReturnType<typeof make>>;
