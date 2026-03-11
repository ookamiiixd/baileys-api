import { createServer } from "node:http";
import {
	HttpApiBuilder,
	HttpApiScalar,
	HttpMiddleware,
	HttpServer,
	HttpServerResponse,
	OpenApi,
} from "@effect/platform";
import { HttpApiDecodeError } from "@effect/platform/HttpApiError";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { baileysApi } from "@wavvy/shared/api";
import { ValidationError } from "@wavvy/shared/response";
import { Effect, Layer, pipe } from "effect";
import { env } from "./lib/env.js";
import { AuthenticationLive } from "./modules/auth/middlewares.js";
import { ConnectionRoutesLive } from "./modules/connections/handlers.js";
import { WithConnectionLive } from "./modules/connections/middlewares.js";
import { ConnectionService } from "./modules/connections/service.js";
import { ContactRoutesLive } from "./modules/contacts/handlers.js";
import { ContactService } from "./modules/contacts/service.js";
import { AppLive } from "./runtime.js";

// Override `HttpApiDecodeError` response shape
const errorMiddleware = HttpMiddleware.make((app) =>
	app.pipe(
		Effect.catchIf(
			(err) => err instanceof HttpApiDecodeError,
			(err) =>
				pipe(
					HttpServerResponse.json(
						{
							success: false,
							_tag: ValidationError._tag,
							message: "Invalid request payload",
							errors: err.issues,
						},
						{ status: 400 },
					),
					Effect.catchAll(() => app),
				),
		),
	),
);

export const MiscRoutesLive = HttpApiBuilder.Router.use((router) =>
	router.get("/openapi.json", HttpServerResponse.json(OpenApi.fromApi(baileysApi))),
);
const RoutesLive = Layer.mergeAll(ConnectionRoutesLive, ContactRoutesLive, MiscRoutesLive);

const ServicesLive = Layer.mergeAll(ConnectionService.Default, ContactService.Default);

const MiddlewaresLive = Layer.mergeAll(
	AuthenticationLive,
	WithConnectionLive,
	HttpApiBuilder.middleware(errorMiddleware),
);

const ApiLive = HttpApiBuilder.api(baileysApi).pipe(
	Layer.provide(RoutesLive),
	Layer.provide(ServicesLive),
	Layer.provide(MiddlewaresLive),
);

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
	Layer.provide(HttpApiScalar.layer()),
	Layer.provide(HttpApiBuilder.middlewareCors()),
	Layer.provide(ApiLive),
	Layer.provide(AppLive),
	HttpServer.withLogAddress,
	Layer.provide(NodeHttpServer.layer(createServer, { port: env.PORT })),
);

Layer.launch(HttpLive).pipe(
	NodeRuntime.runMain({ disablePrettyLogger: env.NODE_ENV === "production" }),
);
