import { FetchHttpClient, HttpApiClient, HttpClient, HttpClientRequest } from "@effect/platform";
import { baileysApi } from "@wavvy/shared/api";
import { Effect, identity, Option, Schedule } from "effect";
import { atom, useAtom } from "jotai";
import type { Auth } from "./auth";

export const httpClientAtom = atom<WavvyHttpClient | null>(null);

export function useRequireHttpClient() {
	const [client] = useAtom(httpClientAtom);
	if (!client) {
		throw new Error("HTTP client is not initialized");
	}

	return client;
}

export type WavvyHttpClient = Effect.Effect.Success<ReturnType<typeof makeHttpClient>>;

export const makeHttpClient = (auth: Auth) =>
	HttpApiClient.make(baileysApi, {
		baseUrl: auth.baseUrl,
		transformClient: (httpClient) =>
			httpClient.pipe(
				HttpClient.filterStatusOk,
				HttpClient.retryTransient({
					schedule: Schedule.jittered(Schedule.exponential("5 seconds")),
					times: 3,
				}),
				Option.isSome(auth.apiKey)
					? HttpClient.mapRequest(HttpClientRequest.bearerToken(auth.apiKey.value))
					: identity,
			),
	}).pipe(Effect.provide(FetchHttpClient.layer));

export const testHttpClient = Effect.fnUntraced(function* (auth: Auth) {
	const client = yield* makeHttpClient(auth);
	return yield* client.Connections.list({ payload: { limit: 1 } }).pipe(
		Effect.timeout("30 seconds"),
		Effect.map(() => [client, null] as const),
		Effect.catchAll((e) => Effect.succeed([null, e] as const)),
	);
});
