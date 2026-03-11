import { HttpApiBuilder } from "@effect/platform";
import { baileysApi } from "@wavvy/shared/api";
import { CurrentConnection } from "@wavvy/shared/modules/connections/middlewares";
import { ContactList } from "@wavvy/shared/modules/contacts/routes";
import { Cursor, CursorFromBase64, PaginationMetadata } from "@wavvy/shared/pagination";
import { mapErrorToResponse } from "@wavvy/shared/response";
import { Effect, Schema as S } from "effect";
import { ContactService } from "./service.js";

export const ContactRoutesLive = HttpApiBuilder.group(baileysApi, "Contacts", (handlers) =>
	Effect.gen(function* () {
		const service = yield* ContactService;

		return handlers.handle("list", ({ payload }) =>
			Effect.gen(function* () {
				const connection = yield* CurrentConnection;
				const [data, totalCount] = yield* service
					.list(connection.recordId, payload)
					.pipe(Effect.mapError(mapErrorToResponse));

				let nextCursor: typeof CursorFromBase64.Encoded | null = null;
				if (data.length > payload.limit) {
					data.pop();

					const last = data[data.length - 1];
					if (last) {
						const cursor = Cursor.make({
							id: last.recordId.toString(),
							date: last.recordCreatedAt,
						});
						nextCursor = yield* S.encode(CursorFromBase64)(cursor).pipe(
							Effect.orElseSucceed(() => null),
						);
					}
				}

				return new ContactList({
					data,
					pagination: PaginationMetadata.make({
						nextCursor,
						totalCount,
					}),
				});
			}),
		);
	}),
);
