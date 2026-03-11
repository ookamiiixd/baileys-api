import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from "@effect/platform";
import { Context, Schema as S } from "effect";
import { ValidationError } from "./../../response.js";
import { ConnectionNotFound } from "./routes.js";
import type { Connection } from "./schema.js";

export class CurrentConnection extends Context.Tag("CurrentConnection")<
	CurrentConnection,
	Connection
>() {}

export class WithConnection extends HttpApiMiddleware.Tag<WithConnection>()("WithConnection", {
	failure: S.Union(ConnectionNotFound, ValidationError),
	provides: CurrentConnection,
	security: {
		connectionId: HttpApiSecurity.apiKey({
			key: "connection-id",
			in: "header",
		}).pipe(HttpApiSecurity.annotate(OpenApi.Description, "The ID of the connection to use. ")),
	},
}) {}
