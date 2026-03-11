import type { Connection as EConnection } from "@wavvy/shared/modules/connections/schema";
import { bigint, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";
import { timestampColumns } from "../columns.js";

export const connections = pgTable("connections", {
	recordId: bigint({ mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),

	name: varchar({ length: 128 }).notNull(),
	phoneNumber: varchar({ length: 15 }).notNull(),
	config: jsonb().$type<typeof EConnection.Encoded.config>().notNull(),

	...timestampColumns,
});
export type Connection = typeof connections.$inferSelect;
export type ConnectionInsert = typeof connections.$inferInsert;
