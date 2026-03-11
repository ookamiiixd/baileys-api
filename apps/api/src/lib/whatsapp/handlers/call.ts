import { Effect, Either } from "effect";
import { makeFilteredEventHandler } from "./utils.js";

export const callHandler = makeFilteredEventHandler(["call"])(
	Effect.fn("WhatsAppSocket.callHandler")(function* ({ connection, socket, events }) {
		if (!events.call || !connection.config.shouldRejectCalls) {
			return;
		}

		for (const call of events.call) {
			if (call.status !== "offer") {
				continue;
			}

			const maybeRejected = yield* Effect.either(
				Effect.tryPromise(() => socket.instance.rejectCall(call.id, call.from)),
			);
			if (Either.isRight(maybeRejected)) {
				yield* Effect.log("Rejected incoming call.", call);
			} else {
				yield* Effect.logError("Failed to reject incoming call:", maybeRejected.left);
			}
		}
	}),
);
