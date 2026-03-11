import { defineConfig } from "drizzle-kit";
import { Redacted } from "effect";
import { env } from "./src/lib/env.js";

export default defineConfig({
	dialect: "postgresql",
	dbCredentials: { url: Redacted.value(env.DATABASE_URL) },
	schema: "./src/lib/db/schema/index.ts",
	out: "./drizzle",
	casing: "snake_case",
	verbose: env.NODE_ENV === "development",
});
