import { HttpApiBuilder, HttpServerResponse } from "@effect/platform";
import { baileysApi } from "@wavvy/shared/api";
import {
	ConnectionList,
	ConnectionPairCode,
	ConnectionQrCode,
	ConnectionRecord,
} from "@wavvy/shared/modules/connections/routes";
import { Cursor, CursorFromBase64, PaginationMetadata } from "@wavvy/shared/pagination";
import { mapErrorToResponse } from "@wavvy/shared/response";
import { formatSseEvent } from "@wavvy/shared/sse";
import { Effect, Schema as S, Stream } from "effect";
import { encodeToJson } from "~/lib/codec.js";
import { ConnectionService } from "./service.js";

export const ConnectionRoutesLive = HttpApiBuilder.group(baileysApi, "Connections", (handlers) =>
	Effect.gen(function* () {
		const service = yield* ConnectionService;

		return handlers
			.handle("create", ({ payload }) =>
				Effect.gen(function* () {
					const data = yield* service.create(payload).pipe(Effect.mapError(mapErrorToResponse));

					return new ConnectionRecord({ data });
				}),
			)
			.handle("list", ({ payload }) =>
				Effect.gen(function* () {
					const [data, totalCount] = yield* service
						.list(payload)
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
								Effect.orElse(() => Effect.succeed(null)),
							);
						}
					}

					return new ConnectionList({
						data,
						pagination: PaginationMetadata.make({
							nextCursor,
							totalCount,
						}),
					});
				}),
			)
			.handle("get", ({ path }) =>
				Effect.gen(function* () {
					const data = yield* service
						.get(path.connectionId)
						.pipe(Effect.mapError(mapErrorToResponse));

					return new ConnectionRecord({ data });
				}),
			)
			.handle("update", ({ path, payload }) =>
				Effect.gen(function* () {
					const data = yield* service
						.update(path.connectionId, payload)
						.pipe(Effect.mapError(mapErrorToResponse));

					return new ConnectionRecord({ data });
				}),
			)
			.handle("delete", ({ path }) =>
				Effect.gen(function* () {
					const data = yield* service
						.del(path.connectionId)
						.pipe(Effect.mapError(mapErrorToResponse));

					return new ConnectionRecord({ data });
				}),
			)
			.handle("getQrCode", ({ path }) =>
				Effect.gen(function* () {
					const data = yield* service
						.getQrCode(path.connectionId)
						.pipe(Effect.mapError(mapErrorToResponse));

					return new ConnectionQrCode({ data });
				}),
			)
			.handle("getPairCode", ({ path }) =>
				Effect.gen(function* () {
					const data = yield* service
						.getPairCode(path.connectionId)
						.pipe(Effect.mapError(mapErrorToResponse));

					return new ConnectionPairCode({ data });
				}),
			)
			.handle("reconnect", ({ path }) =>
				Effect.gen(function* () {
					const data = yield* service
						.reconnect(path.connectionId)
						.pipe(Effect.mapError(mapErrorToResponse));

					return new ConnectionRecord({ data });
				}),
			)
			.handle("disconnect", ({ path }) =>
				Effect.gen(function* () {
					const data = yield* service
						.disconnect(path.connectionId)
						.pipe(Effect.mapError(mapErrorToResponse));

					return new ConnectionRecord({ data });
				}),
			)
			.handle("subscribe", ({ path }) =>
				Effect.gen(function* () {
					const stream = service.subscribe(path.connectionId).pipe(
						Stream.map((data) => formatSseEvent({ data: encodeToJson(data) })),
						Stream.encodeText,
					);

					return HttpServerResponse.stream(stream, {
						contentType: "text/event-stream",
						headers: {
							"cache-control": "no-cache",
							"x-accel-buffering": "no",
						},
					});
				}),
			)
			.handle("subscribeAll", () =>
				Effect.gen(function* () {
					const stream = service.subscribeAll().pipe(
						Stream.map((data) => formatSseEvent({ data: encodeToJson(data) })),
						Stream.encodeText,
					);

					return HttpServerResponse.stream(stream, {
						contentType: "text/event-stream",
						headers: {
							"cache-control": "no-cache",
							"x-accel-buffering": "no",
						},
					});
				}),
			);
	}),
);
