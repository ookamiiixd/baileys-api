import { PlatformConfigProvider } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Config as C, Duration, Effect, Layer, LogLevel } from "effect";

const AppEnv = C.all({
	NODE_ENV: C.literal(
		"development",
		"production",
		"test",
	)("NODE_ENV").pipe(C.withDefault("development")),
	LOG_LEVEL: C.logLevel("LOG_LEVEL").pipe(C.withDefault(LogLevel.Info)),
	ENABLE_DEBUG_EVENTS_TO_FILE: C.boolean("ENABLE_DEBUG_EVENTS_TO_FILE").pipe(C.withDefault(false)),

	PORT: C.integer("PORT").pipe(C.withDefault(3000)),

	DATABASE_URL: C.redacted("DATABASE_URL"),
	API_KEY: C.redacted("API_KEY").pipe(C.option),

	MAX_RECONNECT_ATTEMPTS: C.integer("MAX_RECONNECT_ATTEMPTS").pipe(C.withDefault(5)),
	RECONNECT_BASE_DELAY: C.duration("RECONNECT_BASE_DELAY").pipe(
		C.withDefault(Duration.seconds(10)),
	),

	MAX_QR_GENERATION_ATTEMPTS: C.integer("MAX_QR_GENERATION_ATTEMPTS").pipe(C.withDefault(5)),
	PAIR_CODE_TIMEOUT: C.duration("PAIR_CODE_TIMEOUT").pipe(C.withDefault(Duration.minutes(2))),

	OTEL_EXPORTER_OTLP_TRACE_ENDPOINT: C.url("OTEL_EXPORTER_OTLP_TRACE_ENDPOINT").pipe(C.option),
	OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: C.url("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT").pipe(C.option),
});

const ProviderLive = Layer.provideMerge(
	PlatformConfigProvider.layerDotEnv(".env"),
	NodeFileSystem.layer,
);

export const env = await Effect.runPromise(AppEnv.pipe(Effect.provide(ProviderLive)));
