import { NodeSdk } from "@effect/opentelemetry";
import type { Configuration } from "@effect/opentelemetry/NodeSdk";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor, createLoggerConfigurator } from "@opentelemetry/sdk-logs";
import {
	AlwaysOnSampler,
	BatchSpanProcessor,
	ParentBasedSampler,
	TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { Layer, Option } from "effect";
import { env } from "~/lib/env.js";
import packageJson from "../package.json" with { type: "json" };

const tracerConfig: Configuration["tracerConfig"] = Option.match(
	env.OTEL_EXPORTER_OTLP_TRACE_ENDPOINT,
	{
		onNone: () => undefined,
		onSome: (url) => ({
			sampler:
				env.NODE_ENV === "production"
					? new ParentBasedSampler({
							root: new TraceIdRatioBasedSampler(0.1),
						})
					: new AlwaysOnSampler(),
			spanProcessors: [
				new BatchSpanProcessor(
					new OTLPTraceExporter({
						url: url.toString(),
					}),
				),
			],
		}),
	},
);

const loggerProviderConfig: Configuration["loggerProviderConfig"] = Option.match(
	env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
	{
		onNone: () => undefined,
		onSome: (url) => ({
			loggerConfigurator: createLoggerConfigurator([
				{
					pattern: "*",
					config: {
						disabled: env.LOG_LEVEL.label === "OFF",
						minimumSeverity: mapLogLevelToSeverityNumber(),
					},
				},
			]),
			processors: [
				new BatchLogRecordProcessor(
					new OTLPLogExporter({
						url: url.toString(),
					}),
				),
			],
		}),
	},
);

export const TracerLive =
	tracerConfig || loggerProviderConfig
		? NodeSdk.layer(() => ({
				resource: { serviceName: packageJson.name, serviceVersion: packageJson.version },
				// Apparently Effect only reads processor from the dedicated properties
				// and uses them to determine whether to enable the feature or not
				// https://github.com/Effect-TS/effect/blob/8e2286271a982b1cc34c78fca8b9f59de71fc790/packages/opentelemetry/src/NodeSdk.ts#L90
				spanProcessor: tracerConfig?.spanProcessors,
				tracerConfig,
				logRecordProcessor: loggerProviderConfig?.processors,
				loggerProviderConfig,
			}))
		: Layer.empty;

function mapLogLevelToSeverityNumber() {
	switch (env.LOG_LEVEL.label) {
		case "ALL":
			return SeverityNumber.UNSPECIFIED;
		case "OFF":
			return SeverityNumber.UNSPECIFIED;
	}

	return SeverityNumber[env.LOG_LEVEL.label];
}
