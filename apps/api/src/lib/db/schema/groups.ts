import type { GroupMetadata as BGroupMetadata } from "baileys";
import { bigint, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import type { Encode } from "~/lib/codec.js";
import { timestampColumns } from "../columns.js";
import { connections } from "./connections.js";

export const groups = pgTable(
	"groups",
	{
		recordId: bigint({ mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
		connectionId: bigint({ mode: "number" })
			.notNull()
			.references(() => connections.recordId, { onDelete: "cascade" }),

		id: varchar({ length: 64 }).notNull(),
		data: jsonb().$type<Encode<BGroupMetadata>>().notNull(),

		...timestampColumns,
	},
	(table) => [uniqueIndex("groups_connection_id_id_idx").on(table.connectionId, table.id)],
);
export type Group = typeof groups.$inferSelect;
export type GroupInsert = typeof groups.$inferInsert;
