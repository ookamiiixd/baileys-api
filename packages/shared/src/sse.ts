import { Schema as S } from "effect";

export const SseResponse = S.String.annotations({
	identifier: "SseResponse",
	description: "Sse response data.",
});

export const SseEvent = S.Struct({
	id: S.optional(S.String),
	event: S.optional(S.String),
	data: S.String,
});
export type SseEvent = typeof SseEvent.Type;

export function formatSseEvent(event: SseEvent) {
	const lines: string[] = [];
	if (event.id) {
		lines.push(`id: ${event.id}`);
	}
	if (event.event) {
		lines.push(`event: ${event.event}`);
	}
	lines.push(`data: ${event.data}`);
	lines.push("", "");

	return lines.join("\n");
}
