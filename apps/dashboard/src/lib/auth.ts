import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { Effect, Schema as S, Schema } from "effect";
import { atomWithStorage } from "jotai/utils";
import { testHttpClient } from "./http-client";

export const authAtom = atomWithStorage<typeof Auth.Encoded>(
	"@wavvy/auth",
	{
		baseUrl: import.meta.env.VITE_WAVVY_BASE_URL ?? "http://localhost:3000",
		apiKey: "",
	},
	undefined,
	{ getOnInit: true },
);

export const Auth = S.Struct({
	baseUrl: S.URL,
	apiKey: S.OptionFromNonEmptyTrimmedString,
}).pipe(S.Data, S.standardSchemaV1);
export type Auth = typeof Auth.Type;

export function authQueryOptions(auth: typeof Auth.Encoded) {
	return queryOptions({
		queryKey: [auth],
		placeholderData: keepPreviousData,
		queryFn: async () => {
			const decodedAuth = Schema.decodeUnknownSync(Auth)(auth);
			const [httpClient, error] = await Effect.runPromise(testHttpClient(decodedAuth));
			if (error) {
				throw error;
			}

			return httpClient;
		},
	});
}
