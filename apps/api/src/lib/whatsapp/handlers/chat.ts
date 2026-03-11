import type { Connection } from "@wavvy/shared/modules/connections/schema";
import type { Chat as BChat, ChatUpdate as BChatUpdate } from "baileys";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Effect, Either } from "effect";
import { encode } from "~/lib/codec.js";
import * as Database from "~/lib/db/index.js";
import { getAlternateJidFromDatabase, isLidJid, isPhoneNumberJid, type LidJid } from "../utils.js";
import { makeFilteredEventHandler } from "./utils.js";

export const chatHandler = makeFilteredEventHandler([
	"chats.upsert",
	"chats.update",
	"chats.delete",
])(
	Effect.fn("WhatsAppSocket.chatHandler")(function* ({ connection, events }) {
		const db = yield* Database.Database;

		const upsertData = events["chats.upsert"];
		const upsert = upsertData
			? upsertChats(connection, upsertData, "upsert").pipe(
					Effect.withSpan("WhatsAppSocket.chatHandler.upsert"),
				)
			: Effect.void;

		const updateData = events["chats.update"];
		const update = updateData
			? upsertChats(connection, updateData, "update").pipe(
					Effect.withSpan("WhatsAppSocket.chatHandler.update"),
				)
			: Effect.void;

		const deleteData = events["chats.delete"];
		const del = deleteData
			? Effect.gen(function* () {
					const lids = deleteData.filter(isLidJid);
					const phoneNumbers = deleteData.filter(isPhoneNumberJid);
					const jidsMap = yield* getAlternateJidFromDatabase(phoneNumbers, db);

					for (const phoneNumber of phoneNumbers) {
						const maybeAlternate = jidsMap.get(phoneNumber);
						if (maybeAlternate) {
							lids.push(maybeAlternate as LidJid);
						} else {
							yield* Effect.logWarning(
								`Couldn't find alternate \`jid\` for phone number = "${phoneNumber}". Skipping deletion for this chat.`,
							);
						}
					}

					const affected = yield* db
						.delete(Database.tables.chats)
						.where(
							and(
								eq(Database.tables.chats.connectionId, connection.recordId),
								inArray(Database.tables.chats.id, lids),
							),
						)
						.returning({ recordId: Database.tables.chats.recordId });

					yield* Effect.log(`Deleted ${affected.length} chats.`);
				}).pipe(Effect.withSpan("WhatsAppSocket.chatHandler.delete"))
			: Effect.void;

		const result = yield* Effect.all([upsert, update, del], {
			concurrency: "unbounded",
			mode: "either",
		});
		const errors = result.filter(Either.isLeft).map((e) => e.left);
		if (errors.length > 0) {
			yield* Effect.logError("Finished executing chat handler with errors:", errors);
		}
	}),
);

export const upsertChats: (
	connection: Connection,
	data: BChat[] | BChatUpdate[],
	mode: "upsert" | "update",
	tx?: Database.TransactionClient,
) => Effect.Effect<void, EffectDrizzleQueryError, Database.Database> = Effect.fnUntraced(
	function* (connection, data, mode, tx) {
		const client = tx ?? (yield* Database.Database);
		const chats: Database.tables.ChatInsert[] = [];
		const seenIds = new Set<string>();
		const duplicates: (BChat | BChatUpdate)[] = [];

		for (const chat of data) {
			let id = chat.id;
			if (!id) {
				yield* Effect.logWarning("Received chat without `id`. Skipping.", chat);
				continue;
			}

			// Normalize phone number to lid when possible
			const isPhoneNumber = isPhoneNumberJid(id);
			if (isPhoneNumber && chat.lidJid) {
				id = chat.lidJid;
			} else if (isPhoneNumber) {
				const maybeLid = yield* getAlternateJidFromDatabase(id, client);
				if (maybeLid) {
					id = maybeLid;
				}
			}

			if (seenIds.has(id)) {
				duplicates.push(chat);
				continue;
			}

			seenIds.add(id);
			chats.push({
				data: encode(chat),
				connectionId: connection.recordId,
				id,
			});
		}

		if (chats.length > 0) {
			const affected = yield* client
				.insert(Database.tables.chats)
				.values(chats)
				.onConflictDoUpdate({
					target: [Database.tables.chats.connectionId, Database.tables.chats.id],
					set: {
						data:
							mode === "update"
								? sql`${Database.tables.chats.data}
|| excluded.data
|| jsonb_build_object(
	'unreadCount',
	coalesce(${Database.tables.chats.data}->>'unreadCount', '0')::int +
	coalesce(excluded.data->>'unreadCount', '0')::int
)`
								: sql`excluded.data`,
					},
				})
				.returning({ recordId: Database.tables.chats.recordId });

			yield* Effect.log(`Modified ${affected.length} chats.`);
		}

		if (duplicates.length > 0) {
			yield* Effect.log(`Retrying ${duplicates.length} duplicate chats.`);
			yield* upsertChats(connection, duplicates, mode, tx);
		}
	},
);
