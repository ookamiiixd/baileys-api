import { sql } from "drizzle-orm";
import { timestamp } from "drizzle-orm/pg-core";

export const timestampColumns = {
	recordCreatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	recordUpdatedAt: timestamp({ withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => sql`now()`),
};
