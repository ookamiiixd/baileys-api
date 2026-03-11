import { HttpApiSchema } from "@effect/platform";
import { Schema as S } from "effect";

export const SuccessResponse = S.Struct({
	success: S.Literal(true).pipe(S.optionalWith({ default: () => true })),
	message: S.String.pipe(S.optional),
});

export const BaseError = S.Struct({
	message: S.String.pipe(S.optional),
	stack: S.String.pipe(S.optional),
	cause: S.Unknown.pipe(S.optional),
});

export const ErrorWithPath = S.Struct({
	...BaseError.fields,
	path: S.Array(S.Union(S.String, S.Number, S.Symbol)).annotations({ identifier: "PropertyKey" }),
}).annotations({ identifier: "ErrorWithPath" });

export const ErrorResponse = S.Struct({
	success: S.Literal(false).pipe(S.optionalWith({ default: () => false })),
	...BaseError.fields,
	errors: S.Array(ErrorWithPath).pipe(S.optionalWith({ default: () => [] })),
});

export class ValidationError extends S.TaggedError<ValidationError>()(
	"ValidationError",
	ErrorResponse,
	HttpApiSchema.annotations({
		identifier: "ValidationError",
		status: 400,
	}),
) {}

export class UnexpectedError extends S.TaggedError<UnexpectedError>()(
	"UnexpectedError",
	ErrorResponse,
	HttpApiSchema.annotations({
		identifier: "UnexpectedError",
		status: 500,
	}),
) {}

export function mapErrorToResponse<T extends Error>(
	error: T,
): T extends TaggedErrorResponse ? T : UnexpectedError {
	if (
		error instanceof UnexpectedError ||
		// Leave common response shape as is
		(error instanceof Error && "_tag" in error && "success" in error)
	) {
		return error as any;
	}
	return new UnexpectedError({
		message: "An unexpected error occurred",
		cause: error,
	}) as any;
}

interface TaggedErrorResponse extends Error {
	readonly _tag: string;
	readonly success: boolean;
}
