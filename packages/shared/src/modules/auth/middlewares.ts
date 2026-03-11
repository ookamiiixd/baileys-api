import { HttpApiMiddleware, HttpApiSchema, HttpApiSecurity, OpenApi } from "@effect/platform";
import { Schema as S } from "effect";
import { ErrorResponse } from "./../../response.js";

export class Unauthorized extends S.TaggedError<Unauthorized>()(
	"Unauthorized",
	ErrorResponse,
	HttpApiSchema.annotations({
		identifier: "Unauthorized",
		status: 401,
	}),
) {}

export class Authentication extends HttpApiMiddleware.Tag<Authentication>()("Authentication", {
	failure: Unauthorized,
	security: {
		apiKey: HttpApiSecurity.bearer.pipe(
			HttpApiSecurity.annotate(
				OpenApi.Description,
				"The API key defined in the environment variable `API_KEY`. If not set, authentication will be disabled.",
			),
		),
	},
}) {}
