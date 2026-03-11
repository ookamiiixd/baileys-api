import type { Connection } from "@wavvy/shared/modules/connections/schema";
import type { Contact as BContact } from "baileys";
import { sql } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Effect, Either } from "effect";
import * as Database from "~/lib/db/index.js";
import type { Contact } from "~/lib/db/schema/contacts.js";
import { isGroupJid, isLidJid } from "../utils.js";
import { makeFilteredEventHandler } from "./utils.js";

export const contactHandler = makeFilteredEventHandler(["contacts.upsert", "contacts.update"])(
	Effect.fn("WhatsAppSocket.contactHandler")(function* ({ connection, events }) {
		const upsertData = events["contacts.upsert"];
		const upsert = upsertData
			? upsertContacts(connection, upsertData).pipe(
					Effect.withSpan("WhatsAppSocket.contactHandler.upsert"),
				)
			: Effect.void;

		const updateData = events["contacts.update"];
		const update = updateData
			? upsertContacts(connection, updateData).pipe(
					Effect.withSpan("WhatsAppSocket.contactHandler.update"),
				)
			: Effect.void;

		const result = yield* Effect.all([upsert, update], {
			concurrency: "unbounded",
			mode: "either",
		});
		const errors = result.filter(Either.isLeft).map((e) => e.left);
		if (errors.length > 0) {
			yield* Effect.logError("Finished executing contact handler with errors:", errors);
		}
	}),
);

export const upsertContacts: (
	connection: Connection,
	data: Partial<BContact>[],
	tx?: Database.TransactionClient,
) => Effect.Effect<void, EffectDrizzleQueryError, Database.Database> = Effect.fnUntraced(
	function* (connection, data, tx) {
		const client = tx ?? (yield* Database.Database);
		const contacts: Database.tables.ContactInsert[] = [];
		const seenIds = new Set<string>();
		const duplicates: Partial<BContact>[] = [];

		for (const contact of data) {
			let id = contact.id || contact.lid || contact.phoneNumber;
			if (!id) {
				yield* Effect.logWarning("Received contact without `id`. Skipping.", contact);
				continue;
			}

			if (isGroupJid(id)) {
				yield* Effect.logWarning("Received unexpected group `jid`. Skipping.", contact);
				continue;
			}

			let kind: Contact["idType"] = isLidJid(id) ? "lid" : "phone-number";
			const lidJid = kind === "lid" ? id : contact.lid;
			// Normalize phone number to lid when possible
			if (kind === "phone-number" && lidJid) {
				kind = "lid";
				id = lidJid;
			}

			if (seenIds.has(id)) {
				duplicates.push(contact);
				continue;
			}

			seenIds.add(id);
			contacts.push({
				data: { ...contact, id },
				connectionId: connection.recordId,
				id,
				idType: kind,
			});
		}

		if (contacts.length > 0) {
			const affected = yield* client
				.insert(Database.tables.contacts)
				.values(contacts)
				.onConflictDoUpdate({
					target: [Database.tables.contacts.connectionId, Database.tables.contacts.id],
					set: { data: sql`${Database.tables.contacts.data} || excluded.data` },
				})
				.returning({ recordId: Database.tables.contacts.recordId });

			yield* Effect.log(`Modified ${affected.length} contacts.`);
		}

		if (duplicates.length > 0) {
			yield* Effect.log(`Retrying ${duplicates.length} duplicate contacts.`);
			yield* upsertContacts(connection, duplicates, tx);
		}
	},
);
