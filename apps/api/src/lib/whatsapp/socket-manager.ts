import { NodeCache } from "@cacheable/node-cache";
import { type FileSystem, HttpApiSchema, type Path } from "@effect/platform";
import { type Connection, ConnectionId } from "@wavvy/shared/modules/connections/schema";
import { ErrorResponse } from "@wavvy/shared/response";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import {
	type Cause,
	Deferred,
	Effect,
	Exit,
	HashMap,
	Option,
	PubSub,
	Ref,
	Schema as S,
	Scope,
	Stream,
} from "effect";
import type * as Database from "../db/index.js";
import * as WhatsAppSocket from "./socket.js";

interface WhatsAppSocketManagerMapEntry extends WhatsAppSocket.WhatsAppSocket {
	readonly connection: Connection;
	readonly stateRef: Ref.Ref<WhatsAppSocket.WhatsAppSocketState>;
	readonly scope: Scope.CloseableScope;
	readonly retryCounterCache: NodeCache<unknown>;
}

export class WhatsAppSocketManager extends Effect.Service<WhatsAppSocketManager>()(
	"WhatsAppSocketManager",
	{
		scoped: Effect.gen(function* () {
			const pubsub = yield* PubSub.unbounded<WhatsAppSocket.WhatsAppSocketStreamData>();
			const sockets = yield* Ref.make(HashMap.empty<ConnectionId, WhatsAppSocketManagerMapEntry>());
			const managerScope = yield* Scope.Scope;

			const createInternal: (
				connection: Connection,
				scope: Scope.CloseableScope,
				stateRef: Ref.Ref<WhatsAppSocket.WhatsAppSocketState>,
				retryCounterCache: NodeCache<unknown>,
			) => Effect.Effect<
				WhatsAppSocketManagerMapEntry,
				EffectDrizzleQueryError | Cause.TimeoutException,
				Database.Database | Scope.Scope | FileSystem.FileSystem | Path.Path
			> = Effect.fn("WhatsAppSocketManager.createInternal")(
				function* (connection, scope, stateRef, retryCounterCache) {
					const socket = yield* WhatsAppSocket.make({
						pubsub,
						stateRef,
						connection,
						retryCounterCache,
					}).pipe(Scope.extend(scope));

					const entry: WhatsAppSocketManagerMapEntry = {
						...socket,
						connection,
						stateRef,
						scope,
						retryCounterCache,
					};

					yield* Ref.update(sockets, HashMap.set(connection.recordId, entry));

					// Setup restart handler
					yield* Effect.gen(function* () {
						const shouldRestart = yield* Deferred.await(socket.restartSignal);
						yield* Effect.log(`Received restart signal, restarting = ${shouldRestart}.`);
						// Remove from map then close scope
						yield* Ref.update(sockets, HashMap.remove(connection.recordId));
						yield* Scope.close(scope, Exit.void);

						if (shouldRestart) {
							// Create fresh scope then recreate the socket
							const newScope = yield* Scope.make();
							yield* createInternal(connection, newScope, stateRef, retryCounterCache).pipe(
								Effect.forkIn(managerScope),
							);
						}
					}).pipe(Effect.forkIn(managerScope));
					yield* Effect.log("Connection created.");

					return entry;
				},
			);

			const create = Effect.fn("WhatsAppSocketManager.create")(function* (connection: Connection) {
				const existing = yield* Ref.get(sockets).pipe(
					Effect.flatMap((map) => HashMap.get(map, connection.recordId)),
					Effect.option,
				);
				if (Option.isSome(existing)) {
					return yield* new SocketAlreadyExists({ connectionId: connection.recordId });
				}

				const scope = yield* Scope.make();
				const stateRef = yield* Ref.make<WhatsAppSocket.WhatsAppSocketState>({
					status: "connecting",
					lastDisconnectCode: null,
					qrGenerationAttempts: 0,
					reconnectAttempts: 0,
					qrCode: null,
					pairCode: null,
				});
				const retryCounterCache = new NodeCache();

				return yield* createInternal(connection, scope, stateRef, retryCounterCache).pipe(
					Effect.annotateLogs({ connectionId: connection.recordId }),
					Effect.annotateSpans({ connection }),
				);
			});

			const get = Effect.fn("WhatsAppSocketManager.get")(function* (id: ConnectionId) {
				const existing = yield* Ref.get(sockets).pipe(
					Effect.flatMap((map) => HashMap.get(map, id)),
					Effect.option,
				);
				if (Option.isNone(existing)) {
					return yield* new SocketNotFound({ connectionId: id });
				}

				return existing.value;
			});

			const remove = Effect.fn("WhatsAppSocketManager.remove")(function* (id: ConnectionId) {
				const existing = yield* get(id);
				yield* Scope.close(existing.scope, Exit.void);
				yield* Ref.update(sockets, HashMap.remove(id));
				yield* Effect.log("Connection removed.");
			});

			const restart = Effect.fn("WhatsAppSocketManager.restart")(function* (id: ConnectionId) {
				const existing = yield* get(id);
				const isSignalFired = yield* Deferred.isDone(existing.restartSignal);

				if (!isSignalFired) {
					yield* Deferred.succeed(existing.restartSignal, true);
					yield* Effect.log("Connection restart signal fired.");
				}

				yield* Effect.logWarning(
					"Restart signal already fired for this connection. Attempting to recreate the connection.",
				);
				yield* remove(id).pipe(Effect.catchTag("SocketNotFound", () => Effect.void));
				yield* create(existing.connection).pipe(
					Effect.catchTag("SocketAlreadyExists", () => Effect.void),
				);
			});

			const subscribe = (id: ConnectionId) =>
				Stream.fromPubSub(pubsub).pipe(Stream.filter((data) => data.connection.recordId === id));

			const subscribeAll = () => Stream.fromPubSub(pubsub);

			return {
				create,
				get,
				remove,
				restart,
				subscribe,
				subscribeAll,
			};
		}),
	},
) {}

export class SocketNotFound extends S.TaggedError<SocketNotFound>()(
	"SocketNotFound",
	{
		...ErrorResponse.fields,
		connectionId: ConnectionId,
	},
	HttpApiSchema.annotations({
		identifier: "SocketNotFound",
		status: 404,
	}),
) {
	override message = "Socket not found";
}

export class SocketAlreadyExists extends S.TaggedError<SocketAlreadyExists>()(
	"SocketAlreadyExists",
	{
		...ErrorResponse.fields,
		connectionId: ConnectionId,
	},
	HttpApiSchema.annotations({
		identifier: "SocketAlreadyExists",
		status: 409,
	}),
) {
	override message = "Socket already exists";
}
