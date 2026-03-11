import { PgClient } from "@effect/sql-pg";
import { EffectCache } from "drizzle-orm/cache/core/cache-effect";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { type Context, Effect, Layer, LogLevel, Schedule } from "effect";
import { types } from "pg";
import { env } from "../env.js";
import type { RetryPolicyOptions } from "../retry-policy.js";
import { relations } from "./relations.js";
import * as tables from "./schema/index.js";

const PgClientLive = PgClient.layer({
	url: env.DATABASE_URL,
	types: {
		getTypeParser: (typeId, format) => {
			if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
				return (val: any) => val;
			}
			return types.getTypeParser(typeId, format);
		},
	},
});

const DrizzleServicesLive = Layer.merge(
	EffectCache.Default,
	// Only enable logging on level debug or lower
	LogLevel.greaterThanEqual(LogLevel.Debug, env.LOG_LEVEL)
		? PgDrizzle.EffectLogger.layer
		: PgDrizzle.EffectLogger.Default,
);

export class Database extends Effect.Service<Database>()("Database", {
	effect: PgDrizzle.make({ casing: "snake_case", relations }).pipe(
		Effect.provide(DrizzleServicesLive),
	),
	dependencies: [PgClientLive],
}) {}

export type DatabaseClient = Context.Tag.Service<typeof Database>;
export type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

export const retryPolicy: RetryPolicyOptions = {
	timeoutDuration: "30 seconds",
	retrySchedule: Schedule.jittered(Schedule.exponential("1 second")),
	retryCount: 3,
};

export { tables };
