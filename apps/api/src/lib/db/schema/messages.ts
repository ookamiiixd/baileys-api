import type { WAMessage } from "baileys";
import { bigint, boolean, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import type { Encode } from "~/lib/codec.js";
import { timestampColumns } from "../columns.js";
import { connections } from "./connections.js";

export const messages = pgTable(
	"messages",
	{
		recordId: bigint({ mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
		connectionId: bigint({ mode: "number" })
			.notNull()
			.references(() => connections.recordId, { onDelete: "cascade" }),

		// Extract key for easier query
		id: varchar({ length: 64 }).notNull(),
		remoteJid: varchar({ length: 64 }).notNull(),
		fromMe: boolean().notNull(),
		data: jsonb().$type<Encode<WAMessage>>().notNull(),

		...timestampColumns,
	},
	(table) => [
		uniqueIndex("messages_connection_id_id_from_me_remote_jid_idx").on(
			table.connectionId,
			table.id,
			table.remoteJid,
			table.fromMe,
		),
	],
);
export type Message = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
