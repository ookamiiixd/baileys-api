import { Authentication, Unauthorized } from "@wavvy/shared/modules/auth/middlewares";
import { Effect, Layer, Option, Redacted } from "effect";
import { env } from "~/lib/env.js";

export const AuthenticationLive = Layer.effect(
	Authentication,
	Effect.gen(function* () {
		return {
			apiKey: (token) =>
				Effect.gen(function* () {
					const envValue = Option.match(env.API_KEY, {
						onNone: () => null,
						onSome: (value) => Redacted.value(value),
					});
					const value = Redacted.value(token);

					if (envValue && value !== envValue) {
						return yield* new Unauthorized({ message: "Invalid API key" });
					}
				}),
		};
	}),
);
