import type { Contact as BContact } from "baileys";
import { bigint, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { timestampColumns } from "../columns.js";
import { connections } from "./connections.js";

export const contacts = pgTable(
	"contacts",
	{
		recordId: bigint({ mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
		connectionId: bigint({ mode: "number" })
			.notNull()
			.references(() => connections.recordId, { onDelete: "cascade" }),

		id: varchar({ length: 64 }).notNull(),
		idType: varchar({ length: 12, enum: ["lid", "phone-number"] }).notNull(),
		data: jsonb().$type<BContact>().notNull(),

		...timestampColumns,
	},
	(table) => [uniqueIndex("contacts_connection_id_id_idx").on(table.connectionId, table.id)],
);
export type Contact = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;
