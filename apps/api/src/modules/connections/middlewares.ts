import { WithConnection } from "@wavvy/shared/modules/connections/middlewares";
import { ConnectionNotFound } from "@wavvy/shared/modules/connections/routes";
import { Connection, ConnectionIdFromString } from "@wavvy/shared/modules/connections/schema";
import { ValidationError } from "@wavvy/shared/response";
import { Effect, Layer, ParseResult, Redacted, Schema as S } from "effect";
import * as Database from "~/lib/db/index.js";

export const WithConnectionLive = Layer.effect(
	WithConnection,
	Effect.gen(function* () {
		const db = yield* Database.Database;

		return {
			connectionId: (id) =>
				Effect.gen(function* () {
					const value = Redacted.value(id);
					const connectionId = yield* S.decode(ConnectionIdFromString)(value).pipe(
						Effect.catchAll((e) =>
							Effect.gen(function* () {
								const issues = yield* ParseResult.ArrayFormatter.formatError(e);
								return yield* new ValidationError({
									message: "Invalid connection id",
									errors: issues,
								});
							}),
						),
					);

					const record = yield* db.query.connections
						.findFirst({
							where: { recordId: connectionId },
						})
						.pipe(Effect.mapError(() => new ConnectionNotFound({ connectionId })));
					if (!record) {
						return yield* new ConnectionNotFound({ connectionId });
					}

					return Connection.fromDatabase({
						...record,
						recordCreatedAt: record.recordCreatedAt.toISOString(),
						recordUpdatedAt: record.recordUpdatedAt.toISOString(),
					});
				}),
		};
	}),
);
