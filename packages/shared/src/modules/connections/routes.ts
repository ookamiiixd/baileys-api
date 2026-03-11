import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform";
import { Schema as S } from "effect";
import { PaginationMetadata, PaginationParams } from "../../pagination.js";
import { ErrorResponse, SuccessResponse } from "../../response.js";
import { SseResponse } from "../../sse.js";
import { Authentication } from "../auth/middlewares.js";
import {
	ConnectionId,
	ConnectionIdFromString,
	ConnectionWithStatus,
	CreateConnection,
	UpdateConnection,
} from "./schema.js";

export class ConnectionRecord extends S.TaggedClass<ConnectionRecord>()("ConnectionRecord", {
	...SuccessResponse.fields,
	data: ConnectionWithStatus,
}) {}

export class ConnectionList extends S.TaggedClass<ConnectionList>()("ConnectionList", {
	...SuccessResponse.fields,
	data: S.Array(ConnectionWithStatus),
	pagination: PaginationMetadata,
}) {}

export class ConnectionQrCode extends S.TaggedClass<ConnectionQrCode>()("ConnectionQrCode", {
	...SuccessResponse.fields,
	data: S.Struct({
		value: S.String,
		base64Image: S.String,
	}),
}) {}

export class ConnectionPairCode extends S.TaggedClass<ConnectionPairCode>()("ConnectionPairCode", {
	...SuccessResponse.fields,
	data: S.String,
}) {}

export class ConnectionNotFound extends S.TaggedError<ConnectionNotFound>()(
	"ConnectionNotFound",
	{
		...ErrorResponse.fields,
		connectionId: ConnectionId,
	},
	HttpApiSchema.annotations({
		identifier: "ConnectionNotFound",
		status: 404,
	}),
) {
	override message = "Connection not found";
}

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

const IdParam = HttpApiSchema.param("connectionId", ConnectionIdFromString);

const create = HttpApiEndpoint.post("create", "/")
	.setPayload(CreateConnection)
	.addSuccess(ConnectionRecord)
	.annotate(OpenApi.Summary, "Create Connection")
	.annotate(OpenApi.Description, "Create a new connection.");

const list = HttpApiEndpoint.get("list", "/")
	.setPayload(PaginationParams.pipe(HttpApiSchema.withEncoding({ kind: "UrlParams" })))
	.addSuccess(ConnectionList)
	.annotate(OpenApi.Summary, "List Connections")
	.annotate(OpenApi.Description, "Get a list of all saved connections.");

const get = HttpApiEndpoint.get("get")`/${IdParam}`
	.addSuccess(ConnectionRecord)
	.addError(ConnectionNotFound)
	.annotate(OpenApi.Summary, "Get Connection")
	.annotate(OpenApi.Description, "Get details of a connection by its `id`.");

const update = HttpApiEndpoint.patch("update")`/${IdParam}`
	.setPayload(UpdateConnection)
	.addSuccess(ConnectionRecord)
	.addError(ConnectionNotFound)
	.annotate(OpenApi.Summary, "Update Connection")
	.annotate(OpenApi.Description, "Update a connection by its `id`.");

const del = HttpApiEndpoint.del("delete")`/${IdParam}`
	.addSuccess(ConnectionRecord)
	.addError(ConnectionNotFound)
	.annotate(OpenApi.Summary, "Delete Connection")
	.annotate(OpenApi.Description, "Delete a connection by its `id`.");

const getQrCode = HttpApiEndpoint.get("getQrCode")`/${IdParam}/qr-code`
	.addSuccess(ConnectionQrCode)
	.addError(SocketNotFound)
	.annotate(OpenApi.Summary, "Get QR Code")
	.annotate(OpenApi.Description, "Get the QR code for a connection by its `id`.");

const getPairCode = HttpApiEndpoint.get("getPairCode")`/${IdParam}/pair-code`
	.addSuccess(ConnectionPairCode)
	.addError(SocketNotFound)
	.annotate(OpenApi.Summary, "Get Pair Code")
	.annotate(OpenApi.Description, "Get the pair code for a connection by its `id`.");

const reconnect = HttpApiEndpoint.post("reconnect")`/${IdParam}/reconnect`
	.addSuccess(ConnectionRecord)
	.addError(SocketNotFound)
	.annotate(OpenApi.Summary, "Reconnect Connection")
	.annotate(
		OpenApi.Description,
		"Reconnect a connection by its `id`. If the connection is already connected, it will be reconnected.",
	);

const disconnect = HttpApiEndpoint.post("disconnect")`/${IdParam}/disconnect`
	.addSuccess(ConnectionRecord)
	.addError(SocketNotFound)
	.annotate(OpenApi.Summary, "Disconnect Connection")
	.annotate(
		OpenApi.Description,
		"Disconnect a connection by its `id`. If the connection is already disconnected, it will be ignored.",
	);

const subscribe = HttpApiEndpoint.get("subscribe")`/${IdParam}/events`
	.addSuccess(
		SseResponse.pipe(
			HttpApiSchema.withEncoding({
				kind: "Text",
				contentType: "text/event-stream",
			}),
		),
	)
	.annotate(OpenApi.Summary, "Subscribe Events")
	.annotate(OpenApi.Description, "Subscribe to baileys events for a connection socket by `id`.");

const subscribeAll = HttpApiEndpoint.get("subscribeAll", "/events")
	.addSuccess(
		SseResponse.pipe(
			HttpApiSchema.withEncoding({
				kind: "Text",
				contentType: "text/event-stream",
			}),
		),
	)
	.annotate(OpenApi.Summary, "Subscribe All Events")
	.annotate(OpenApi.Description, "Subscribe to baileys events for all active connection sockets.");

export const connectionRoutes = HttpApiGroup.make("Connections")
	.add(create)
	.add(list)
	.add(get)
	.add(update)
	.add(del)
	.add(getQrCode)
	.add(getPairCode)
	.add(reconnect)
	.add(disconnect)
	.add(subscribe)
	.add(subscribeAll)
	.prefix("/connections")
	.middleware(Authentication)
	.annotate(OpenApi.Description, "Connection related endpoints.");
