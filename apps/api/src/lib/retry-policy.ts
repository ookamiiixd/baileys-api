import { type Cause, type Duration, Effect, type Schedule } from "effect";

export interface RetryPolicyOptions {
	readonly timeoutDuration: Duration.DurationInput;
	readonly retrySchedule: Schedule.Schedule<unknown, unknown, unknown>;
	readonly retryCount?: number;
}

export const makeRetryPolicy =
	({ timeoutDuration, retrySchedule, retryCount }: RetryPolicyOptions) =>
	<A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E | Cause.TimeoutException, R> =>
		self.pipe(
			Effect.timeout(timeoutDuration),
			Effect.retry({ schedule: retrySchedule, times: retryCount }),
		) as any;
