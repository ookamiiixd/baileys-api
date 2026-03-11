import type { ConnectionId } from "@wavvy/shared/modules/connections/schema";
import { Contact, ContactIdFromString } from "@wavvy/shared/modules/contacts/schema";
import type { PaginationParams } from "@wavvy/shared/pagination";
import { eq, sql } from "drizzle-orm";
import { DateTime, Effect, Schema as S } from "effect";
import * as Database from "~/lib/db/index.js";

export class ContactService extends Effect.Service<ContactService>()("ContactService", {
	effect: Effect.gen(function* () {
		const db = yield* Database.Database;

		const list = Effect.fn("ContactService.list")(function* (
			connectionId: ConnectionId,
			params: PaginationParams,
		) {
			const cursor = params.cursor
				? {
						id: yield* S.decode(ContactIdFromString)(params.cursor.id),
						date: DateTime.toDate(params.cursor.date),
					}
				: null;

			const totalCountQuery = db.$count(
				Database.tables.contacts,
				eq(Database.tables.contacts.connectionId, connectionId),
			);
			const recordsQuery = db.query.contacts.findMany({
				where: {
					connectionId,
					...(cursor
						? {
								RAW: (table) =>
									sql`(${table.recordCreatedAt}, ${table.recordId}) < (${cursor.date}, ${cursor.id})`,
							}
						: undefined),
				},
				orderBy: { recordCreatedAt: "desc", recordId: "desc" },
				limit: params.limit + 1,
			});

			const [totalCount, records] = yield* Effect.all([totalCountQuery, recordsQuery], {
				concurrency: "unbounded",
			});
			const contacts = records.map((record) => Contact.fromDatabase(record));

			return [contacts, totalCount] as const;
		});

		return { list };
	}),
}) {}
