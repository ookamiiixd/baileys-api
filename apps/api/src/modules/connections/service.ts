import { ConnectionNotFound } from "@wavvy/shared/modules/connections/routes";
import {
	ConnectionId,
	ConnectionIdFromString,
	ConnectionWithStatus,
	CreateConnection,
	UpdateConnection,
} from "@wavvy/shared/modules/connections/schema";
import type { PaginationParams } from "@wavvy/shared/pagination";
import { UnexpectedError } from "@wavvy/shared/response";
import { eq, sql } from "drizzle-orm";
import { Effect, Schema as S } from "effect";
import QrCode from "qrcode";
import * as Database from "~/lib/db/index.js";
import { WhatsAppSocketManager } from "~/lib/whatsapp/socket-manager.js";

export class ConnectionService extends Effect.Service<ConnectionService>()("ConnectionService", {
	effect: Effect.gen(function* () {
		const db = yield* Database.Database;
		const manager = yield* WhatsAppSocketManager;

		const create = Effect.fn("ConnectionService.create")(function* (input: CreateConnection) {
			const encoded = yield* S.encode(CreateConnection)(input);
			const [record] = yield* db
				.insert(Database.tables.connections)
				.values({
					...encoded,
					config: encoded.config ?? { shouldRejectCalls: false },
				})
				.returning();
			if (!record) {
				return yield* new UnexpectedError({ message: "Failed to create connection" });
			}

			let connection = ConnectionWithStatus.fromDatabase({
				...record,
				recordCreatedAt: record.recordCreatedAt.toISOString(),
				recordUpdatedAt: record.recordUpdatedAt.toISOString(),
			});
			if (input.shouldConnect) {
				const status = yield* manager.create(connection).pipe(
					Effect.flatMap((socket) => socket.state),
					Effect.map((state) => state.status),
					// Should never happen, but just to satisfy the type
					Effect.catchTag(
						"SocketAlreadyExists",
						(e) => new UnexpectedError({ message: "Socket already exists", cause: e }),
					),
				);
				connection = connection.update({ status });
			}

			return connection;
		});

		const list = Effect.fn("ConnectionService.list")(function* (params: PaginationParams) {
			const cursorId = params.cursor
				? yield* S.decode(ConnectionIdFromString)(params.cursor.id)
				: null;

			const totalCountQuery = db.$count(Database.tables.connections);
			const recordsQuery = db.query.connections.findMany({
				where: cursorId ? { recordId: { lt: cursorId } } : undefined,
				orderBy: { recordId: "desc" },
				limit: params.limit + 1,
			});

			const [totalCount, records] = yield* Effect.all([totalCountQuery, recordsQuery], {
				concurrency: "unbounded",
			});

			const connections: ConnectionWithStatus[] = [];
			for (const record of records) {
				const id = ConnectionId.make(record.recordId);
				const status = yield* manager.get(id).pipe(
					Effect.flatMap((socket) => socket.state),
					Effect.map((state) => state.status),
					Effect.orElseSucceed(() => "disconnected" as const),
				);

				connections.push(
					ConnectionWithStatus.fromDatabase({
						...record,
						recordCreatedAt: record.recordCreatedAt.toISOString(),
						recordUpdatedAt: record.recordUpdatedAt.toISOString(),
						status,
					}),
				);
			}

			return [connections, totalCount] as const;
		});

		const get = Effect.fn("ConnectionService.get")(function* (id: ConnectionId) {
			const record = yield* db.query.connections.findFirst({
				where: { recordId: id },
			});
			if (!record) {
				return yield* new ConnectionNotFound({ connectionId: id });
			}

			const status = yield* manager.get(id).pipe(
				Effect.flatMap((socket) => socket.state),
				Effect.map((state) => state.status),
				Effect.orElseSucceed(() => "disconnected" as const),
			);

			return ConnectionWithStatus.fromDatabase({
				...record,
				recordCreatedAt: record.recordCreatedAt.toISOString(),
				recordUpdatedAt: record.recordUpdatedAt.toISOString(),
				status,
			});
		});

		const update = Effect.fn("ConnectionService.update")(function* (
			id: ConnectionId,
			input: UpdateConnection,
		) {
			const encoded = yield* S.encode(UpdateConnection)(input);
			const [record] = yield* db
				.update(Database.tables.connections)
				.set({
					...encoded,
					config: encoded.config
						? sql`${Database.tables.connections.config} || ${encoded.config}`
						: undefined,
				})
				.where(eq(Database.tables.connections.recordId, id))
				.returning();
			if (!record) {
				return yield* new ConnectionNotFound({ connectionId: id });
			}

			if (input.shouldConnect) {
				yield* manager
					.restart(id)
					.pipe(
						Effect.mapError(
							(e) => new UnexpectedError({ message: "Failed to restart connection", cause: e }),
						),
					);
			}

			const status = yield* manager.get(id).pipe(
				Effect.flatMap((socket) => socket.state),
				Effect.map((state) => state.status),
				Effect.orElseSucceed(() => "disconnected" as const),
			);

			return ConnectionWithStatus.fromDatabase({
				...record,
				recordCreatedAt: record.recordCreatedAt.toISOString(),
				recordUpdatedAt: record.recordUpdatedAt.toISOString(),
				status,
			});
		});

		const del = Effect.fn("ConnectionService.delete")(function* (id: ConnectionId) {
			const [record] = yield* db
				.delete(Database.tables.connections)
				.where(eq(Database.tables.connections.recordId, id))
				.returning();
			if (!record) {
				return yield* new ConnectionNotFound({ connectionId: id });
			}

			yield* manager.get(id).pipe(
				Effect.flatMap((socket) => Effect.tryPromise(() => socket.instance.logout())),
				// We wan't the remove to always be executed whether logout succeed or not
				Effect.catchTag("UnknownException", () => Effect.void),
				Effect.flatMap(() => manager.remove(id)),
				Effect.catchAll(() => Effect.void),
			);

			return ConnectionWithStatus.fromDatabase({
				...record,
				recordCreatedAt: record.recordCreatedAt.toISOString(),
				recordUpdatedAt: record.recordUpdatedAt.toISOString(),
			});
		});

		const getQrCode = Effect.fn("ConnectionService.getQrCode")(function* (id: ConnectionId) {
			const value = yield* manager.get(id).pipe(
				Effect.flatMap((socket) => socket.state),
				Effect.map((state) => state.qrCode),
			);
			const base64Image = value ? yield* Effect.tryPromise(() => QrCode.toDataURL(value)) : null;

			if (value && base64Image) {
				return { value, base64Image };
			}
			return yield* new UnexpectedError({
				message: "An unexpected error occurred while processing the QR code",
			});
		});

		const getPairCode = Effect.fn("ConnectionService.getPairCode")(function* (id: ConnectionId) {
			return yield* manager.get(id).pipe(Effect.flatMap((socket) => socket.requestPairCode()));
		});

		const reconnect = Effect.fn("ConnectionService.reconnect")(function* (id: ConnectionId) {
			yield* manager.restart(id).pipe(
				Effect.catchTag("SocketNotFound", () =>
					get(id).pipe(
						Effect.flatMap((connection) => manager.create(connection)),
						Effect.catchAll(() => Effect.void),
					),
				),
			);

			const socket = yield* manager.get(id);
			const status = yield* socket.state.pipe(Effect.map((state) => state.status));

			return ConnectionWithStatus.make({ ...socket.connection, status });
		});

		const disconnect = Effect.fn("ConnectionService.disconnect")(function* (id: ConnectionId) {
			const socket = yield* manager.get(id);
			yield* manager.remove(id);

			return ConnectionWithStatus.make({ ...socket.connection, status: "disconnected" });
		});

		const subscribe = manager.subscribe;

		const subscribeAll = manager.subscribeAll;

		return {
			create,
			list,
			get,
			update,
			del,
			getQrCode,
			getPairCode,
			reconnect,
			disconnect,
			subscribe,
			subscribeAll,
		};
	}),
}) {}
