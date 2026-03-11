import type { AuthenticationCreds, SignalDataTypeMap } from "baileys";
import { bigint, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import type { Encode } from "~/lib/codec.js";
import { timestampColumns } from "../columns.js";
import { connections } from "./connections.js";

type Data = Encode<AuthenticationCreds | SignalDataTypeMap[keyof SignalDataTypeMap]>;

export const authStates = pgTable(
	"auth_states",
	{
		recordId: bigint({ mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
		connectionId: bigint({ mode: "number" })
			.notNull()
			.references(() => connections.recordId, { onDelete: "cascade" }),

		name: varchar({ length: 255 }).notNull(),
		data: jsonb().$type<Data>(),

		...timestampColumns,
	},
	(table) => [uniqueIndex("auth_states_connection_id_name_idx").on(table.connectionId, table.name)],
);
export type AuthState = typeof authStates.$inferSelect;
export type AuthStateInsert = typeof authStates.$inferInsert;
