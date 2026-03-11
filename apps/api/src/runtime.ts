import { DevTools } from "@effect/experimental";
import { NodeContext } from "@effect/platform-node";
import { Layer, Logger, ManagedRuntime } from "effect";
import * as Database from "./lib/db/index.js";
import { env } from "./lib/env.js";
import { WhatsAppSocketManager } from "./lib/whatsapp/socket-manager.js";
import { TracerLive } from "./tracer.js";

export const AppLive = Layer.mergeAll(
	Logger.minimumLogLevel(env.LOG_LEVEL),
	DevTools.layer(),
	TracerLive,
	Database.Database.Default,
	WhatsAppSocketManager.Default,
	NodeContext.layer,
);

export const runtime = ManagedRuntime.make(AppLive);
