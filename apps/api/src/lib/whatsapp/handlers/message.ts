import type { Connection } from "@wavvy/shared/modules/connections/schema";
import {
	areJidsSameUser,
	jidNormalizedUser,
	updateMessageWithEventResponse,
	updateMessageWithPollUpdate,
	updateMessageWithReaction,
	updateMessageWithReceipt,
	type WAMessage,
	type WAMessageKey,
	type WASocket,
} from "baileys";
import { and, eq, sql } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Effect, Either } from "effect";
import { decode, encode } from "~/lib/codec.js";
import * as Database from "~/lib/db/index.js";
import type { MakeNonNullable } from "~/lib/types.js";
import type { WhatsAppSocket } from "../socket.js";
import { getAlternateJidFromDatabase, isLidJid, isPhoneNumberJid } from "../utils.js";
import { makeFilteredEventHandler } from "./utils.js";

const REQUEST_PLACEHOLDER = "requestPlaceholder";
const ON_DEMAND_HISTORY_SYNC = "onDemandHistSync";

export const messageHandler = makeFilteredEventHandler([
	"messages.upsert",
	"messages.update",
	"messages.delete",
	"messages.reaction",
	"message-receipt.update",
])(
	Effect.fn("WhatsAppSocket.messageHandler")(function* ({ socket, connection, events }) {
		const db = yield* Database.Database;

		const upsertData = events["messages.upsert"];
		const upsert = upsertData
			? Effect.gen(function* () {
					let args: UpsertArgs = { type: "append" };
					if (upsertData.type === "notify" && upsertData.requestId) {
						args = { type: "notify", requestId: upsertData.requestId, instance: socket.instance };
					}

					const data = yield* prepareMessages(socket, connection, upsertData.messages, db);
					yield* upsertMessages(connection, data, args, db);
				}).pipe(Effect.withSpan("WhatsAppSocket.messageHandler.upsert"))
			: Effect.void;

		const updateData = events["messages.update"];
		const update = updateData
			? Effect.gen(function* () {
					const data = yield* prepareMessages(
						socket,
						connection,
						updateData.map((u) => ({ ...u.update, key: u.key })),
						db,
					);
					yield* upsertMessages(connection, data, { type: "append" }, db);
				}).pipe(Effect.withSpan("WhatsAppSocket.messageHandler.update"))
			: Effect.void;

		const deleteData = events["messages.delete"];
		const del = deleteData
			? Effect.gen(function* () {
					if ("all" in deleteData) {
						let remoteJid = deleteData.jid;
						if (isPhoneNumberJid(remoteJid)) {
							const maybeLid = yield* getAlternateJidFromDatabase(remoteJid, db);
							if (maybeLid) {
								remoteJid = maybeLid;
							}
						}

						yield* db
							.delete(Database.tables.messages)
							.where(
								and(
									eq(Database.tables.messages.connectionId, connection.recordId),
									eq(Database.tables.messages.remoteJid, remoteJid),
								),
							);
					} else {
						const deletions: MakeNonNullable<WAMessageKey, "id" | "remoteJid">[] = [];
						const jidsMap = yield* getAlternateJidFromDatabase(
							deleteData.keys.map((k) => k.remoteJid).filter(isPhoneNumberJid),
							db,
						);

						for (const key of deleteData.keys) {
							let remoteJid = key.remoteJid;
							if (!key.id || !remoteJid) {
								yield* Effect.logWarning(
									"Received message deletion key without `id` or `remoteJid`. Skipping.",
									key,
								);
								continue;
							}

							if (isPhoneNumberJid(remoteJid)) {
								const maybeLid = jidsMap.get(remoteJid);
								if (maybeLid) {
									remoteJid = maybeLid;
								}
							}

							deletions.push({ ...key, id: key.id, remoteJid });
						}

						if (deletions.length <= 0) {
							return;
						}

						yield* db.transaction((tx) =>
							Effect.gen(function* () {
								for (const key of deletions) {
									yield* tx
										.delete(Database.tables.messages)
										.where(
											and(
												eq(Database.tables.messages.connectionId, connection.recordId),
												eq(Database.tables.messages.id, key.id),
												eq(Database.tables.messages.remoteJid, key.remoteJid),
												eq(Database.tables.messages.fromMe, key.fromMe ?? false),
											),
										);
								}
							}),
						);
					}
				}).pipe(Effect.withSpan("WhatsAppSocket.messageHandler.delete"))
			: Effect.void;

		const reactionData = events["messages.reaction"];
		const reaction = reactionData
			? Effect.gen(function* () {
					const data = yield* prepareMessages(
						socket,
						connection,
						reactionData.map((r) => ({ key: r.key, reactions: [r.reaction] })),
						db,
					);
					yield* aggregateField(
						connection,
						data,
						"reactions",
						(message, reactions) =>
							reactions.forEach((reaction) => {
								updateMessageWithReaction(message, reaction);
								// Delete un-reactions (empty text)
								message.reactions = message.reactions?.filter((r) => !!r.text) ?? [];
							}),
						db,
					);

					yield* upsertMessages(connection, data, { type: "append" }, db);
				}).pipe(Effect.withSpan("WhatsAppSocket.messageHandler.reaction"))
			: Effect.void;

		const receiptData = events["message-receipt.update"];
		const receipt = receiptData
			? Effect.gen(function* () {
					const data = yield* prepareMessages(
						socket,
						connection,
						receiptData.map((u) => ({ key: u.key, userReceipt: [u.receipt] })),
						db,
					);
					yield* aggregateField(
						connection,
						data,
						"userReceipt",
						(message, receipts) =>
							receipts.forEach((receipt) => {
								updateMessageWithReceipt(message, receipt);
							}),
						db,
					);

					yield* upsertMessages(connection, data, { type: "append" }, db);
				}).pipe(Effect.withSpan("WhatsAppSocket.messageHandler.receipt"))
			: Effect.void;

		const result = yield* Effect.all([upsert, update, del, reaction, receipt], {
			concurrency: "unbounded",
			mode: "either",
		});
		const errors = result.filter(Either.isLeft).map((e) => e.left);
		if (errors.length > 0) {
			yield* Effect.logError("Finished executing message handler with errors:", errors);
		}
	}),
);

type UpsertArgs =
	| {
			type: "append";
	  }
	| {
			type: "notify";
			requestId: string;
			instance: WASocket;
	  };

export const upsertMessages: (
	connection: Connection,
	data: Database.tables.MessageInsert[],
	args?: UpsertArgs,
	maybeClient?: Database.TransactionClient | Database.DatabaseClient,
) => Effect.Effect<void, EffectDrizzleQueryError, Database.Database> = Effect.fnUntraced(function* (
	connection,
	data,
	args = { type: "append" },
	maybeClient,
) {
	const client = maybeClient ?? (yield* Database.Database);
	const messages: Database.tables.MessageInsert[] = [];
	const seenIds = new Set<string>();
	const duplicates: Database.tables.MessageInsert[] = [];

	for (const message of data) {
		const id = makeMessageKey(message.id, message.remoteJid, message.fromMe);
		if (seenIds.has(id)) {
			duplicates.push(message);
			continue;
		}

		seenIds.add(id);
		messages.push(message);
	}

	yield* aggregateField(
		connection,
		messages,
		"pollUpdates",
		(message, polls) =>
			polls.forEach((update) => {
				updateMessageWithPollUpdate(message, update);
			}),
		client,
	);

	yield* aggregateField(
		connection,
		messages,
		"eventResponses",
		(message, responses) =>
			responses.forEach((resp) => {
				updateMessageWithEventResponse(message, resp);
			}),
		client,
	);

	if (messages.length <= 0) {
		return;
	}

	const affected = yield* client
		.insert(Database.tables.messages)
		.values(messages)
		.onConflictDoUpdate({
			target: [
				Database.tables.messages.connectionId,
				Database.tables.messages.id,
				Database.tables.messages.remoteJid,
				Database.tables.messages.fromMe,
			],
			set: { data: sql`${Database.tables.messages.data} || excluded.data` },
		})
		.returning({ recordId: Database.tables.messages.recordId });

	yield* Effect.log(`Modified ${affected.length} messages.`);

	if (args.type === "notify") {
		const decodedMessages = data.map((m) => decode(m.data));
		for (const message of decodedMessages) {
			const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
			if (text === REQUEST_PLACEHOLDER) {
				const maybeSuccess = yield* Effect.either(
					Effect.tryPromise(() => args.instance.requestPlaceholderResend(message.key)),
				);
				if (Either.isLeft(maybeSuccess)) {
					yield* Effect.logError("Failed to request placeholder sync:", maybeSuccess.left);
				} else {
					yield* Effect.log("Requested placeholder sync.", message.key);
				}
			}

			if (text === ON_DEMAND_HISTORY_SYNC) {
				const timestamp = message.messageTimestamp;
				if (!timestamp) {
					yield* Effect.logWarning(
						"Message doesn't have a valid timestamp. Skipping on-demand history sync.",
						message,
					);
					continue;
				}

				const maybeSuccess = yield* Effect.either(
					Effect.tryPromise(() => args.instance.fetchMessageHistory(50, message.key, timestamp)),
				);
				if (Either.isLeft(maybeSuccess)) {
					yield* Effect.logError("Failed to request on-demand history sync:", maybeSuccess.left);
				} else {
					yield* Effect.log("Requested on-demand history sync.", message.key);
				}
			}
		}
	}

	if (duplicates.length > 0) {
		yield* Effect.log(`Retrying ${duplicates.length} duplicate messages.`);
		yield* upsertMessages(connection, duplicates, args, client);
	}
});

export const prepareMessages = Effect.fnUntraced(function* (
	socket: WhatsAppSocket,
	connection: Connection,
	data: WAMessage[],
	client?: Database.DatabaseClient | Database.TransactionClient,
) {
	const messages: Database.tables.MessageInsert[] = [];
	const jidsMap = yield* getAlternateJidFromDatabase(
		data.map((m) => m.key.remoteJid).filter(isPhoneNumberJid),
		client,
	);

	for (const message of data) {
		const id = message.key?.id;
		let remoteJid = message.key?.remoteJid;
		if (!id || !remoteJid) {
			yield* Effect.logWarning("Received message without `id` or `remoteJid`. Skipping.", message);
			continue;
		}

		const isPhoneNumber = isPhoneNumberJid(remoteJid);
		const isOwnPhoneNumber =
			isPhoneNumber &&
			areJidsSameUser(
				remoteJid,
				jidNormalizedUser(socket.instance.user?.phoneNumber ?? socket.instance.user?.id),
			);
		const ownLid = jidNormalizedUser(socket.instance.user?.lid);

		// Normalize phone number to lid when possible
		if (isOwnPhoneNumber && ownLid) {
			remoteJid = ownLid;
		} else if (isPhoneNumber && message.key.remoteJidAlt && isLidJid(message.key.remoteJidAlt)) {
			remoteJid = message.key.remoteJidAlt;
		} else if (isPhoneNumber) {
			const maybeLid = jidsMap.get(remoteJid);
			if (maybeLid) {
				remoteJid = maybeLid;
			}
		}

		const encoded = encode(message);
		messages.push({
			data: encoded,
			connectionId: connection.recordId,
			id,
			remoteJid,
			fromMe: encoded.key.fromMe ?? false,
		});
	}

	return messages;
});

const makeMessageKey = (id: string, remoteJid: string, fromMe: boolean) =>
	`${id}-${remoteJid}-${fromMe}`;

const aggregateField = Effect.fnUntraced(function* <TField extends keyof WAMessage>(
	connection: Connection,
	messages: Database.tables.MessageInsert[],
	field: TField,
	updateFn: (message: WAMessage, item: NonNullable<WAMessage[TField]>) => void,
	client: Database.DatabaseClient | Database.TransactionClient,
) {
	const messagesToProcess = messages.filter((m) => m.data[field]);
	if (messagesToProcess.length === 0) {
		return;
	}

	const messagesMap = new Map(
		messagesToProcess.map((m) => [makeMessageKey(m.id, m.remoteJid, m.fromMe), m]),
	);

	// Fetch existing data
	const existingMessages = yield* client.query.messages.findMany({
		where: {
			connectionId: connection.recordId,
			OR: messagesToProcess.map((m) => ({
				id: m.id,
				remoteJid: m.remoteJid,
				fromMe: m.fromMe,
			})),
		},
	});

	for (const existing of existingMessages) {
		const message = messagesMap.get(
			makeMessageKey(existing.id, existing.remoteJid, existing.fromMe),
		);
		if (!message || !message.data[field]) {
			continue;
		}

		// Apply updates
		const decoded = decode(existing.data);
		const update = decode(message.data[field]);
		updateFn(decoded, update);

		// Mutate the original reference
		const encoded = encode(decoded);
		message.data[field] = encoded[field];
	}
});
