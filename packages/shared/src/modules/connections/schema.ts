import type { BaileysEventMap } from "baileys";
import { Schema as S } from "effect";
import { Timestamps } from "../../schema.js";
import type { MakeOptional } from "../../types.js";

export const ConnectionId = S.Number.pipe(
	S.int(),
	S.positive(),
	S.brand("ConnectionId"),
).annotations({
	description: "A unique identifier for the connection.",
});
export type ConnectionId = typeof ConnectionId.Type;

export const ConnectionIdFromString = S.transform(
	S.NumberFromString.pipe(S.int(), S.positive()),
	ConnectionId,
	{
		strict: true,
		decode: (value) => ConnectionId.make(value),
		encode: (value) => value,
	},
);
export type ConnectionIdFromString = typeof ConnectionIdFromString.Type;

export const PhoneNumber = S.String.pipe(
	S.pattern(/^[1-9]\d{1,14}$/),
	S.brand("PhoneNumber"),
).annotations({
	description: "A phone number in E.164 format without the plus (+) sign.",
});
export type PhoneNumber = typeof PhoneNumber.Type;

export class Connection extends S.Class<Connection>("Connection")({
	recordId: ConnectionId,
	name: S.String.pipe(S.trimmed(), S.minLength(1), S.maxLength(128)).annotations({
		description: "A human-readable name for the connection.",
	}),
	phoneNumber: PhoneNumber,
	config: S.Struct({
		shouldRejectCalls: S.Boolean.annotations({
			description: "Whether to reject any incoming calls on this WhatsApp connection.",
		}),
		proxyUrls: S.Array(S.URL).pipe(S.optional).annotations({
			description:
				"A list of available proxy urls to route WhatsApp traffic through. Will be used based on the order and availability. If none work, proxy will be skipped. Not supported on `Bun`.",
		}),
		webhooks: S.Array(
			S.Struct({
				url: S.URL.annotations({
					description: "The webhook url to send events to.",
				}),
				authToken: S.String.pipe(S.optional).annotations({
					description:
						"An optional auth token to include in the webhook request headers. Will be sent as `Authorization: Bearer <token>`.",
				}),
				events: S.Array(S.String).pipe(S.optional).annotations({
					description:
						"A list of baileys event names to send to this webhook. Leave empty to receive all events. But it's recommended to specify only the events you need.",
				}),
			}),
		)
			.pipe(S.optional)
			.annotations({
				description: `A list of webhooks to send events to. The request will be sent as POST request with a JSON body of these properties:
| Field | Description |
|-|-|
| \`connection\` | The associated connection info. |
| \`events\` | The events data with the shape of \`BaileysEventMap\`. |
| \`receivedAt\` | The timestamp when the events are received. |

The request will only consider \`20x\` status codes as successful, and will retry with exponential backoff for transient errors (e.g. network issues, \`5xx\` responses).`,
			}),
		baileysConfig: S.Record({ key: S.String, value: S.Any }).pipe(S.optional).annotations({
			description:
				"Custom configuration that you want to pass to the baileys socket instance. Limited to JSON-serializable values.",
		}),
	}).pipe(S.optionalWith({ default: () => ({ shouldRejectCalls: false }) })),

	...Timestamps.fields,
}) {
	update(input: Partial<Pick<Connection, "name" | "phoneNumber" | "config">>) {
		return Connection.make({
			...this,
			...input,
		});
	}

	static fromDatabase(input: typeof Connection.Encoded) {
		return S.decodeSync(Connection)(input);
	}
}

export class ConnectionWithStatus extends Connection.extend<ConnectionWithStatus>(
	"ConnectionWithStatus",
)(
	{
		status: S.Literal("authenticated", "connected", "connecting", "disconnected").annotations({
			description: `The current status of the connection.
| Field | Description |
|-|-|
| \`authenticated\` | The connection is connected and authenticated to the WhatsApp server. |
| \`connected\` | The connection is connected to the WhatsApp server, but not authenticated yet. This can happen during the initial connection phase, or when the connection is temporarily disconnected and trying to reconnect. |
| \`connecting\` | The connection is in the process of connecting, but not connected yet. |
| \`disconnected\` | The connection is disconnected. This can happen when the connection is closed, or when it fails to connect/reconnect. |
`,
		}),
	},
	{
		identifier: "Connection",
		description: "Represents a connection with its configuration and metadata.",
	},
) {
	override update(
		input: Partial<Pick<ConnectionWithStatus, "name" | "phoneNumber" | "config" | "status">>,
	) {
		return ConnectionWithStatus.make({
			...this,
			...input,
		});
	}

	static fromDatabase(input: MakeOptional<typeof ConnectionWithStatus.Encoded, "status">) {
		return ConnectionWithStatus.make({
			status: "disconnected",
			...Connection.fromDatabase(input),
		});
	}
}

export const CreateConnection = Connection.pipe(
	S.pick("name", "phoneNumber", "config"),
	S.extend(
		S.Struct({
			shouldConnect: S.Boolean.pipe(S.optionalWith({ default: () => false })).annotations({
				description:
					"Whether to immediately try to connect after creating/updating the connection. Defaults to `false`.",
			}),
		}),
	),
);
export type CreateConnection = typeof CreateConnection.Type;

export const UpdateConnection = CreateConnection.pipe(
	S.pick("name", "phoneNumber"),
	S.partial,
	S.extend(CreateConnection.pipe(S.pick("config", "shouldConnect"))),
);
export type UpdateConnection = typeof UpdateConnection.Type;

export const BaileysEvents = S.declare(
	(input): input is Partial<BaileysEventMap> => typeof input === "object",
	{
		identifier: "BaileysEvents",
		description: "Baileys events data",
	},
);
export type BaileysEvents = typeof BaileysEvents.Type;

export const ConnectionSseData = S.Struct({
	connection: Connection,
	events: BaileysEvents,
});
export type ConnectionSseData = typeof ConnectionSseData.Type;
