import type NodeCache from "@cacheable/node-cache";
import { FileSystem, Path } from "@effect/platform";
import type { Connection, ConnectionWithStatus } from "@wavvy/shared/modules/connections/schema";
import makeWASocket, {
	type BaileysEventMap,
	Browsers,
	type CacheStore,
	DisconnectReason,
	makeCacheableSignalKeyStore,
	proto,
	type WAMessageKey,
	type WASocket,
} from "baileys";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import {
	type Cause,
	Deferred,
	Effect,
	Either,
	PubSub,
	Queue,
	Ref,
	Runtime,
	type Scope,
	Stream,
} from "effect";
import * as Database from "~/lib/db/index.js";
import { decode, encodeToJson } from "../codec.js";
import { env } from "../env.js";
import { getFirstWorkingProxyAgent } from "../proxy.js";
import * as WhatsAppAuthState from "./auth-state.js";
import { callHandler } from "./handlers/call.js";
import { chatHandler } from "./handlers/chat.js";
import { connectionHandler } from "./handlers/connection.js";
import { contactHandler } from "./handlers/contact.js";
import { groupHandler } from "./handlers/group.js";
import { historySyncHandler } from "./handlers/history-sync.js";
import { messageHandler } from "./handlers/message.js";
import { type EventHandlerOptions, makeFilteredEventHandler } from "./handlers/utils.js";
import { webhookHandler } from "./handlers/webhook.js";
import { BaileysLogger } from "./logger.js";
import { type AnyJid, getAlternateJidFromDatabase, isLidJid, isPhoneNumberJid } from "./utils.js";

export interface WhatsAppSocketStreamData {
	readonly connection: Connection;
	readonly events: Partial<BaileysEventMap>;
}

export interface WhatsAppSocketState {
	readonly status: ConnectionWithStatus["status"];
	readonly lastDisconnectCode: DisconnectReason | null;
	readonly qrGenerationAttempts: number;
	readonly reconnectAttempts: number;
	readonly qrCode: string | null;
	readonly pairCode: string | null;
}

export interface WhatsAppSocketOptions {
	readonly pubsub: PubSub.PubSub<WhatsAppSocketStreamData>;
	readonly stateRef: Ref.Ref<WhatsAppSocketState>;
	readonly connection: Connection;
	readonly retryCounterCache: NodeCache<unknown>;
}

export interface WhatsAppSocket {
	readonly state: Effect.Effect<WhatsAppSocketState>;
	readonly instance: WASocket;
	readonly restartSignal: Deferred.Deferred<boolean>;
	readonly requestPairCode: () => Effect.Effect<
		string,
		Cause.TimeoutException | Cause.UnknownException
	>;
	readonly getAlternateJid: (
		jid: string,
	) => Effect.Effect<
		AnyJid | null,
		EffectDrizzleQueryError | Cause.UnknownException,
		Database.Database
	>;
}

export const make: ({
	pubsub,
	stateRef,
	connection,
	retryCounterCache,
}: WhatsAppSocketOptions) => Effect.Effect<
	WhatsAppSocket,
	EffectDrizzleQueryError | Cause.TimeoutException,
	Scope.Scope | Database.Database | FileSystem.FileSystem | Path.Path
> = Effect.fn("WhatsAppSocket.make")(function* ({
	pubsub,
	stateRef,
	connection,
	retryCounterCache,
}) {
	const runtime = yield* Effect.runtime<Database.Database>();
	const eventQueue = yield* Queue.unbounded<WhatsAppSocketStreamData>();
	const restartSignal = yield* Deferred.make<boolean>();
	const firstQrCodeSignal = yield* Deferred.make<string>();

	const authState = yield* WhatsAppAuthState.make(connection);
	const logger = new BaileysLogger(runtime);
	const agent = connection.config.proxyUrls
		? yield* getFirstWorkingProxyAgent(connection.config.proxyUrls.map((u) => u.toString())).pipe(
				Effect.orElseSucceed(() => null),
			)
		: null;

	const instance = makeWASocket({
		generateHighQualityLinkPreview: true,
		markOnlineOnConnect: false,
		syncFullHistory: true,
		browser: Browsers.windows("Desktop"),
		...connection.config.baileysConfig,
		...(agent ? { agent, fetchAgent: agent } : {}),
		logger,
		msgRetryCounterCache: retryCounterCache as CacheStore,
		auth: {
			creds: authState.state.creds,
			keys: makeCacheableSignalKeyStore(
				authState.state.keys,
				logger.child({ name: "SignalKeyStoreCache" }),
			),
		},
		getMessage: (key) => Runtime.runPromise(runtime)(getMessageBody(connection, key)),
		cachedGroupMetadata: (jid) => Runtime.runPromise(runtime)(getGroupMetadata(connection, jid)),
	});

	const requestPairCode = Effect.fn("WhatsAppSocket.requestPairCode")(function* () {
		const state = yield* Ref.get(stateRef);
		if (!state.qrCode) {
			// Add 1 minute timeout since it should be impossible for qr event
			// to take that long to be fired, unless something went wrong
			yield* Deferred.await(firstQrCodeSignal).pipe(Effect.timeout("1 minute"));
		}

		const pairCode = yield* Effect.tryPromise(() =>
			instance.requestPairingCode(connection.phoneNumber),
		);
		yield* Ref.update(stateRef, (s) => ({ ...s, pairCode }));
		yield* Effect.log("Pair code generated:", pairCode);

		// Create a timeout that instructs to destroy the socket if not authenticated
		// within the timeout period after requesting pair code
		yield* Effect.gen(function* () {
			yield* Effect.sleep(env.PAIR_CODE_TIMEOUT);

			if (!authState.state.creds.me?.id) {
				yield* Effect.logError("Pair code timeout reached. Signaling for socket destruction.");
				yield* Deferred.succeed(restartSignal, false);
			}
		})
			// Don't need to scope this, as this is redundant if the socket is destroyed anyway
			.pipe(Effect.fork);

		return pairCode;
	});

	const getAlternateJid: WhatsAppSocket["getAlternateJid"] = Effect.fn(
		"WhatsAppSocket.getAlternateJid",
	)(function* (jid: string) {
		const maybeAlternateJid = yield* getAlternateJidFromDatabase(jid);
		if (maybeAlternateJid) {
			return maybeAlternateJid;
		}

		// If it's not phone number, then assume it's lid per baileys normalization
		const kind = isPhoneNumberJid(jid) ? "phone-number" : "lid";
		if (!jid.includes("@")) {
			jid = `${jid}@lid`;
		}

		// Instruct baileys to do the lookup as final resort
		const result = yield* Effect.tryPromise(() =>
			kind === "phone-number"
				? instance.signalRepository.lidMapping.getLIDForPN(jid)
				: instance.signalRepository.lidMapping.getPNForLID(jid),
		);
		return result as AnyJid | null;
	});

	const socket = {
		state: Ref.get(stateRef),
		instance,
		restartSignal,
		requestPairCode,
		getAlternateJid,
	} as const;

	const authHandler = makeFilteredEventHandler(["connection.update", "creds.update"])(
		Effect.fnUntraced(function* ({ events }) {
			if (events["connection.update"]) {
				const update = events["connection.update"];
				const isSignalFired = yield* Deferred.isDone(firstQrCodeSignal);
				if (update.qr && !isSignalFired) {
					yield* Deferred.succeed(firstQrCodeSignal, update.qr);
				}
			}

			if (events["creds.update"]) {
				yield* authState.save();
			}
		}),
	);

	const debugHandler = Effect.fnUntraced(function* ({ events }: EventHandlerOptions) {
		if (!env.ENABLE_DEBUG_EVENTS_TO_FILE) {
			return;
		}

		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const target = path.join(
			process.cwd(),
			"debug",
			`events-${Date.now()}-${crypto.randomUUID()}.json`,
		);
		yield* fs
			.writeFileString(target, encodeToJson(events, 2))
			.pipe(Effect.catchAll((e) => Effect.logError("Failed to write events debug file:", e)));
	});

	const handlerStream = Stream.fromQueue(eventQueue).pipe(
		Stream.map((data) => ({ ...data, socket, stateRef })),
		Stream.flatMap((args) =>
			Effect.all(
				[
					connectionHandler(args),
					authHandler(args),
					historySyncHandler(args),
					contactHandler(args),
					chatHandler(args),
					messageHandler(args),
					groupHandler(args),
					callHandler(args),
					webhookHandler(args),
					debugHandler(args),
				],
				{
					concurrency: "unbounded",
					mode: "either",
				},
			),
		),
		Stream.tap((result) =>
			Effect.gen(function* () {
				const errors = result.filter(Either.isLeft).map((e) => e.left);
				if (errors.length > 0) {
					yield* Effect.logError("Finished executing handlers with errors:", errors);
				}
			}),
		),
		Stream.ensuring(Effect.log("Handler stream finalized.")),
	);
	yield* Stream.runDrain(handlerStream).pipe(Effect.forkScoped);

	const eventsCleanup = instance.ev.process(async (events) => {
		await Effect.runPromiseExit(
			Effect.gen(function* () {
				yield* Queue.offer(eventQueue, { connection, events });
				yield* PubSub.publish(pubsub, { connection, events });
			}),
		);
	});

	yield* Effect.addFinalizer(() =>
		Effect.gen(function* () {
			yield* Effect.log("Executing socket cleanup.");
			// Flush any remaining events, then detach the handler
			instance.ev.flush();
			eventsCleanup();

			const lastState = yield* socket.state;
			// If authenticated and not logged out, persist the credentials
			if (
				authState.state.creds.me?.id &&
				lastState.lastDisconnectCode !== DisconnectReason.loggedOut
			) {
				yield* authState
					.save()
					.pipe(
						Effect.catchAll((e) =>
							Effect.logError("Failed to save auth credentials during socket cleanup:", e),
						),
					);
			} else if (lastState.lastDisconnectCode === DisconnectReason.loggedOut) {
				// Otherwise, clean up the auth state from database
				yield* authState
					.reset()
					.pipe(
						Effect.catchAll((e) =>
							Effect.logError("Failed to clean up auth states during socket cleanup:", e),
						),
					);
			}

			// Close the socket connection if not already closed
			if (!lastState.lastDisconnectCode) {
				instance.end(new Error("Intentional socket shutdown."));
			}
		}),
	);

	return socket;
});

const getMessageBody = Effect.fnUntraced(function* (connection: Connection, key: WAMessageKey) {
	const db = yield* Database.Database;
	const id = key.id;
	let remoteJid = key.remoteJid;
	if (!id || !remoteJid) {
		return undefined;
	}

	const isPhoneNumber = isPhoneNumberJid(remoteJid);
	if (isPhoneNumber && key.remoteJidAlt && isLidJid(key.remoteJidAlt)) {
		remoteJid = key.remoteJidAlt;
	} else if (isPhoneNumber) {
		const maybeLid = yield* getAlternateJidFromDatabase(remoteJid, db);
		if (maybeLid) {
			remoteJid = maybeLid;
		}
	}

	const message = yield* db.query.messages.findFirst({
		where: {
			connectionId: connection.recordId,
			id,
			remoteJid,
			fromMe: key.fromMe ?? false,
		},
	});
	if (!message) {
		return undefined;
	}

	const maybeMessage = yield* Effect.either(Effect.try(() => decode(message.data)));
	if (Either.isLeft(maybeMessage) || !maybeMessage.right.message) {
		return undefined;
	}

	return proto.Message.fromObject(maybeMessage.right.message);
});

const getGroupMetadata = Effect.fnUntraced(function* (connection: Connection, jid: string) {
	const db = yield* Database.Database;
	const group = yield* db.query.groups.findFirst({
		where: {
			connectionId: connection.recordId,
			id: jid,
		},
	});
	if (!group) {
		return undefined;
	}

	const maybeMetadata = yield* Effect.either(Effect.try(() => decode(group.data)));
	if (Either.isLeft(maybeMetadata)) {
		return undefined;
	}

	return maybeMetadata.right;
});
