import type { Contact as BContact, LIDMapping } from "baileys";
import { Effect } from "effect";
import * as Database from "~/lib/db/index.js";
import { upsertChats } from "./chat.js";
import { upsertContacts } from "./contact.js";
import { upsertGroups } from "./group.js";
import { prepareMessages, upsertMessages } from "./message.js";
import { makeFilteredEventHandler } from "./utils.js";

export const historySyncHandler = makeFilteredEventHandler(["messaging-history.set"])(
	Effect.fn("WhatsAppSocket.historySyncHandler")(function* ({ socket, connection, events }) {
		const data = events["messaging-history.set"] as (typeof events)["messaging-history.set"] & {
			lidPnMappings?: LIDMapping[];
		};
		if (!data) {
			return;
		}

		const db = yield* Database.Database;
		yield* db
			.transaction((tx) =>
				Effect.gen(function* () {
					yield* upsertContacts(connection, data.contacts, tx);
					yield* upsertChats(connection, data.chats, "upsert", tx);
					const messages = yield* prepareMessages(socket, connection, data.messages, tx);
					yield* upsertMessages(connection, messages, { type: "append" }, tx);

					// Update existing phone number-based contacts to switch to lid-based
					if (data.lidPnMappings) {
						const map: Record<string, string> = {};
						for (const mapping of data.lidPnMappings) {
							map[mapping.pn] = mapping.lid;
						}

						const phoneNumbers = data.lidPnMappings.map((m) => m.pn);
						const foundContacts = yield* tx.query.contacts.findMany({
							where: {
								connectionId: connection.recordId,
								id: { in: phoneNumbers },
								idType: "phone-number",
							},
						});

						const contactsToUpdate: BContact[] = [];
						for (const contact of foundContacts) {
							const lid = map[contact.id];
							if (lid) {
								contactsToUpdate.push({ id: lid, lid, phoneNumber: contact.id });
							}
						}
						yield* upsertContacts(connection, contactsToUpdate, tx);
					}

					// Force sync groups
					const groups = socket.instance.groupFetchAllParticipating();
					yield* upsertGroups(connection, Object.values(groups), tx);
				}),
			)
			.pipe(Effect.catchAll((e) => Effect.logError("Failed to process history sync data:", e)));
	}),
);
