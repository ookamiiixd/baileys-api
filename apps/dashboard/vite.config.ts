import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "./src"),
		},
	},
	define: {
		__WAVVY_VERSION__: JSON.stringify(pkg.version),
	},
});
