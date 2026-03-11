import type { Chat as BChat } from "baileys";
import { bigint, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import type { Encode } from "~/lib/codec.js";
import { timestampColumns } from "../columns.js";
import { connections } from "./connections.js";

export const chats = pgTable(
	"chats",
	{
		recordId: bigint({ mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
		connectionId: bigint({ mode: "number" })
			.notNull()
			.references(() => connections.recordId, { onDelete: "cascade" }),

		id: varchar({ length: 64 }).notNull(),
		data: jsonb().$type<Encode<BChat>>().notNull(),

		...timestampColumns,
	},
	(table) => [uniqueIndex("chats_connection_id_id_idx").on(table.connectionId, table.id)],
);
export type Chat = typeof chats.$inferSelect;
export type ChatInsert = typeof chats.$inferInsert;
