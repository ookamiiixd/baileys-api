import { Effect, Either, Schema as S } from "effect";
import { ProxyAgent } from "proxy-agent";
import { ProxyAgent as UndiciProxyAgent, fetch as undiciFetch } from "undici";

const TEST_URL = "https://httpbin.org/get";
const DEFAULT_TIMEOUT = 15_000;
const IS_BUN = process.versions.bun !== undefined;

export const getFirstWorkingProxyAgent = Effect.fn("Utils.getFirstWorkingProxyAgent")(function* (
	proxies: string[],
	testUrl: string = TEST_URL,
	timeoutMs: number = DEFAULT_TIMEOUT,
) {
	if (IS_BUN && proxies.length > 0) {
		// Bun has issues with proxying requests via node http agent which `baileys` uses,
		// so we just skip it for now
		// https://github.com/oven-sh/bun/issues/15499
		yield* Effect.logWarning("Bun runtime detected, proxy will be ignored.");
		return yield* new NoWorkingProxyError({ message: "Proxy is not supported on Bun runtime" });
	}

	for (const proxy of proxies) {
		const agent = new ProxyAgent({ getProxyForUrl: () => proxy });
		const undiciAgent = new UndiciProxyAgent(proxy);
		const signal = AbortSignal.timeout(timeoutMs);
		const maybeResponse = yield* Effect.either(
			Effect.tryPromise(() => undiciFetch(testUrl, { signal, dispatcher: undiciAgent })),
		);
		if (Either.isRight(maybeResponse) && maybeResponse.right.ok) {
			return agent;
		}
	}

	return yield* new NoWorkingProxyError({ message: "No working proxy found" });
});

export class NoWorkingProxyError extends S.TaggedError<NoWorkingProxyError>()(
	"NoWorkingProxyError",
	{ message: S.String },
) {}
