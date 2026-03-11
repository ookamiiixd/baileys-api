import type { Connection } from "@wavvy/shared/modules/connections/schema";
import type { GroupMetadata } from "baileys";
import { sql } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Effect, Either } from "effect";
import * as Database from "~/lib/db/index.js";
import { makeFilteredEventHandler } from "./utils.js";

export const groupHandler = makeFilteredEventHandler([
	"groups.upsert",
	"groups.update",
	"group-participants.update",
])(
	Effect.fn("WhatsAppSocket.groupHandler")(function* ({ connection, events }) {
		const upsertData = events["groups.upsert"];
		const upsert = upsertData
			? upsertGroups(connection, upsertData).pipe(
					Effect.withSpan("WhatsAppSocket.groupHandler.upsert"),
				)
			: Effect.void;

		const updateData = events["groups.update"];
		const update = updateData
			? upsertGroups(connection, updateData).pipe(
					Effect.withSpan("WhatsAppSocket.groupHandler.update"),
				)
			: Effect.void;

		const participantsUpdateData = events["group-participants.update"];
		const participantsUpdate = participantsUpdateData
			? Effect.gen(function* () {
					const db = yield* Database.Database;
					const data = participantsUpdateData;
					const existingGroup = yield* db.query.groups.findFirst({
						where: {
							connectionId: connection.recordId,
							id: data.id,
						},
					});
					if (!existingGroup) {
						yield* Effect.logWarning(
							"Received group participants update for non-existent group. Skipping.",
							data,
						);
						return;
					}

					const participantsMap = new Map(existingGroup.data.participants.map((p) => [p.id, p]));
					for (const participant of data.participants) {
						switch (data.action) {
							case "add":
								participantsMap.set(participant.id, participant);
								break;
							case "demote":
							case "promote": {
								const existing = participantsMap.get(participant.id);
								if (existing) {
									participantsMap.set(participant.id, {
										...existing,
										isAdmin: data.action === "promote",
									});
								}
								break;
							}
							case "modify": {
								const existing = participantsMap.get(participant.id);
								if (existing) {
									participantsMap.set(participant.id, { ...existing, ...participant });
								}

								break;
							}
							case "remove":
								participantsMap.delete(participant.id);
						}
					}

					yield* upsertGroups(connection, [
						{
							id: data.id,
							participants: Array.from(participantsMap.values()),
						},
					]);
				}).pipe(Effect.withSpan("WhatsAppSocket.groupHandler.participantsUpdate"))
			: Effect.void;

		const result = yield* Effect.all([upsert, update, participantsUpdate], {
			concurrency: "unbounded",
			mode: "either",
		});
		const errors = result.filter(Either.isLeft).map((e) => e.left);
		if (errors.length > 0) {
			yield* Effect.logError("Finished executing group handler with errors:", errors);
		}
	}),
);

export const upsertGroups: (
	connection: Connection,
	data: Partial<GroupMetadata>[],
	tx?: Database.TransactionClient,
) => Effect.Effect<void, EffectDrizzleQueryError, Database.Database> = Effect.fnUntraced(
	function* (connection, data, tx) {
		const client = tx ?? (yield* Database.Database);
		const groups: Database.tables.GroupInsert[] = [];
		const seenIds = new Set<string>();
		const duplicates: Partial<GroupMetadata>[] = [];

		for (const group of data) {
			const maybeId = group.id;
			if (!maybeId) {
				yield* Effect.logWarning("Received group without `id`. Skipping.", group);
				continue;
			}

			if (seenIds.has(maybeId)) {
				duplicates.push(group);
				continue;
			}

			seenIds.add(maybeId);
			groups.push({
				data: group as any,
				id: maybeId,
				connectionId: connection.recordId,
			});
		}

		if (groups.length > 0) {
			const affected = yield* client
				.insert(Database.tables.groups)
				.values(groups)
				.onConflictDoUpdate({
					target: [Database.tables.groups.connectionId, Database.tables.groups.id],
					set: { data: sql`${Database.tables.groups.data} || excluded.data` },
				})
				.returning({ recordId: Database.tables.groups.recordId });

			yield* Effect.log(`Modified ${affected.length} groups.`);
		}

		if (duplicates.length > 0) {
			yield* Effect.log(`Retrying ${duplicates.length} duplicate groups.`);
			yield* upsertGroups(connection, duplicates, tx);
		}
	},
);
