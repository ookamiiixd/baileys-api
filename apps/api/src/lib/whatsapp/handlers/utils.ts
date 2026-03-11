import type { BaileysEventMap } from "baileys";
import { Effect } from "effect";
import type * as WhatsAppSocket from "../socket.js";

export interface EventHandlerOptions
	extends WhatsAppSocket.WhatsAppSocketStreamData,
		Pick<WhatsAppSocket.WhatsAppSocketOptions, "stateRef"> {
	readonly socket: WhatsAppSocket.WhatsAppSocket;
}

export const makeFilteredEventHandler =
	<K extends keyof BaileysEventMap>(eventNames: K[]) =>
	<A, E, R>(
		handler: (
			options: Omit<EventHandlerOptions, "events"> & {
				readonly events: Partial<Pick<BaileysEventMap, K>>;
			},
		) => Effect.Effect<A, E, R>,
	) =>
		Effect.fnUntraced(function* (options: EventHandlerOptions) {
			const filteredEvents: Partial<Pick<BaileysEventMap, K>> = {};
			for (const eventName of eventNames) {
				if (eventName in options.events) {
					filteredEvents[eventName] = options.events[eventName];
				}
			}

			if (Object.keys(filteredEvents).length > 0) {
				yield* handler({ ...options, events: filteredEvents });
			}
		});
