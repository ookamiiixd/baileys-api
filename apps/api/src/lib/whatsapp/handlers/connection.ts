import { Boom } from "@hapi/boom";
import { DisconnectReason, jidNormalizedUser } from "baileys";
import { eq } from "drizzle-orm";
import { Deferred, Duration, Effect, Ref } from "effect";
import QrCode from "qrcode";
import * as Database from "~/lib/db/index.js";
import { env } from "~/lib/env.js";
import { isPhoneNumberJid } from "../utils.js";
import { makeFilteredEventHandler } from "./utils.js";

export const connectionHandler = makeFilteredEventHandler(["connection.update"])(
	Effect.fn("WhatsAppSocket.connectionHandler")(function* ({
		connection,
		stateRef,
		socket,
		events,
	}) {
		const update = events["connection.update"];
		if (!update) {
			return;
		}

		const state = yield* socket.state;

		// Handle QR code
		if (update.qr) {
			const qrCode = update.qr;
			const qrGenerationAttempts = state.qrGenerationAttempts + 1;
			yield* Ref.update(stateRef, (s) => ({ ...s, qrCode, qrGenerationAttempts }));

			if (qrGenerationAttempts > env.MAX_QR_GENERATION_ATTEMPTS) {
				yield* Effect.logError(
					"Max QR generation attempts reached. Signaling for socket destruction.",
				);
				yield* Deferred.succeed(socket.restartSignal, false);
			} else {
				// Only log qr image to terminal in development mode
				const terminalQrImage =
					env.NODE_ENV === "development"
						? yield* Effect.tryPromise(() =>
								QrCode.toString(qrCode, { type: "terminal", small: true }),
							).pipe(
								Effect.catchAll((e) =>
									Effect.gen(function* () {
										yield* Effect.logError("Failed to generate qr image for terminal:", e);
										return null;
									}),
								),
							)
						: null;
				yield* Effect.log(
					`QR code received (attempt ${qrGenerationAttempts}/${env.MAX_QR_GENERATION_ATTEMPTS})` +
						(terminalQrImage ? `\n${terminalQrImage}` : ""),
				);
			}
		}

		if (update.connection === "connecting") {
			// `connecting` essentially means baileys trying authenticate to WhatsApp
			// and websocket is already connected, not that it's connecting to websocket
			yield* Ref.update(stateRef, (s) => ({
				...s,
				status: "connected" as const,
				lastDisconnectCode: null,
			}));
		}

		// Handle successful connection
		if (update.connection === "open") {
			yield* Ref.update(stateRef, () => ({
				status: "authenticated" as const,
				lastDisconnectCode: null,
				qrGenerationAttempts: 0,
				reconnectAttempts: 0,
				qrCode: null,
				pairCode: null,
			}));
			yield* Effect.log("Connection authenticated.");

			// Sync phone number with the actual authenticated one if they differ
			const me = socket.instance.authState.creds.me;
			if (!me) {
				return;
			}

			const jid = jidNormalizedUser(me?.phoneNumber ?? me.id);
			const [maybePhoneNumber] = jid.split("@");
			if (isPhoneNumberJid(jid) && maybePhoneNumber !== connection.phoneNumber) {
				const db = yield* Database.Database;
				yield* db
					.update(Database.tables.connections)
					.set({ phoneNumber: maybePhoneNumber })
					.where(eq(Database.tables.connections.recordId, connection.recordId));
			}
		}

		// Handle disconnection
		if (update.connection === "close") {
			const code =
				update.lastDisconnect?.error instanceof Boom
					? update.lastDisconnect.error.output.statusCode
					: 0;
			yield* Ref.update(stateRef, (s) => ({
				...s,
				status: "disconnected" as const,
				lastDisconnectCode: code || null,
			}));

			if (code === DisconnectReason.loggedOut) {
				yield* Effect.logError("Logged out. Signaling for socket destruction.");
				yield* Deferred.succeed(socket.restartSignal, false);
				return;
			}

			const reconnectAttempts = state.reconnectAttempts + 1;
			yield* Ref.update(stateRef, (s) => ({ ...s, reconnectAttempts }));
			if (reconnectAttempts > env.MAX_RECONNECT_ATTEMPTS) {
				yield* Effect.logError(`Max reconnect attempts reached. Signaling for socket destruction.`);
				yield* Deferred.succeed(socket.restartSignal, false);
				return;
			}

			if (code !== DisconnectReason.restartRequired) {
				// Subtract by 1 since we incremented it earlier
				const delay = 2 ** (reconnectAttempts - 1) * Duration.toMillis(env.RECONNECT_BASE_DELAY);
				yield* Effect.logWarning(
					`Disconnected (attempt ${reconnectAttempts}/${env.MAX_RECONNECT_ATTEMPTS}), reconnecting in ${(delay / 1_000).toFixed(1)}s`,
				);
				yield* Effect.sleep(Duration.millis(delay));
			}

			// Signal restart
			yield* Deferred.succeed(socket.restartSignal, true);
		}
	}),
);
