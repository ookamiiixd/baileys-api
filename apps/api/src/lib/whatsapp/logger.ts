import type { ILogger } from "baileys/lib/Utils/logger.js";
import { Effect, Runtime } from "effect";
import { env } from "../env.js";

type BaileysLogLevel = "trace" | "debug" | "info" | "warn" | "error";

export class BaileysLogger implements ILogger {
	level = env.LOG_LEVEL.label;
	#runtime: Runtime.Runtime<never>;
	#annotations?: Record<string, unknown>;

	constructor(runtime: Runtime.Runtime<never>, annotations?: Record<string, unknown>) {
		this.#runtime = runtime;
		if (annotations) {
			this.#annotations = annotations;
		}
	}

	child(obj: Record<string, unknown>): ILogger {
		return new BaileysLogger(this.#runtime, { ...this.#annotations, ...obj });
	}

	trace(obj: unknown, msg?: string) {
		this.#log("trace", msg, obj);
	}

	debug(obj: unknown, msg?: string) {
		this.#log("debug", msg, obj);
	}

	info(obj: unknown, msg?: string) {
		this.#log("info", msg, obj);
	}

	warn(obj: unknown, msg?: string) {
		this.#log("warn", msg, obj);
	}

	error(obj: unknown, msg?: string) {
		this.#log("error", msg, obj);
	}

	#log(level: BaileysLogLevel, ...args: unknown[]) {
		if (args.length === 0) {
			return;
		}

		const log = getEffectLogger(level);
		void Runtime.runPromiseExit(this.#runtime)(
			log(...args).pipe(Effect.annotateLogs(this.#annotations ?? {})),
		);
	}
}

function getEffectLogger(level: BaileysLogLevel) {
	switch (level) {
		case "trace":
			return Effect.logTrace;
		case "debug":
			return Effect.logDebug;
		case "info":
			return Effect.logInfo;
		case "warn":
			return Effect.logWarning;
		case "error":
			return Effect.logError;
	}
}
