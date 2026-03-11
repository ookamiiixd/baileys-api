import { DateTime, ParseResult, Schema as S } from "effect";

export const Cursor = S.Struct({
	id: S.String,
	date: S.DateTimeUtcFromSelf,
}).annotations({
	identifier: "Cursor",
	description: "A cursor for pagination.",
});
export type Cursor = typeof Cursor.Type;

export const CursorFromBase64 = S.transformOrFail(S.String, Cursor, {
	strict: true,
	decode: (value, _, ast) => {
		try {
			const decoded = atob(value);
			const parsed = JSON.parse(decoded);
			parsed.date = DateTime.unsafeFromDate(new Date(parsed.date));
			return ParseResult.succeed(S.decodeUnknownSync(Cursor)(parsed));
		} catch {
			return ParseResult.fail(
				new ParseResult.Type(ast, value, "An error occurred while decoding the cursor."),
			);
		}
	},
	encode: (value) => {
		const json = JSON.stringify(value);
		return ParseResult.succeed(btoa(json));
	},
}).annotations({
	description: "A cursor for pagination, encoded as a base64 string.",
	identifier: "CursorFromBase64",
});
export type CursorFromBase64 = typeof CursorFromBase64.Type;

export const PaginationParams = S.Struct({
	cursor: CursorFromBase64.pipe(S.optional),
	limit: S.NumberFromString.pipe(
		S.int(),
		S.positive(),
		S.lessThanOrEqualTo(100),
		S.optionalWith({ default: () => 25 }),
	),
}).annotations({
	description: `Pagination parameters for listing endpoints.
| Field | Description |
|-|-|
| \`cursor\` | The cursor for pagination. This should be the value of the \`nextCursor\` field from the previous response. It encodes the position after which to start returning results. |
| \`limit\` | The number of items to return per page. Default is 25. |
`,
	identifier: "PaginationParams",
});
export type PaginationParams = typeof PaginationParams.Type;

export const PaginationMetadata = S.Struct({
	nextCursor: S.String.pipe(S.NullOr),
	totalCount: S.Number,
}).annotations({
	description: `Metadata for paginated responses.
| Field | Description |
|-|-|
| \`nextCursor\` | The cursor for the next page. This can be used as the \`cursor\` parameter in the next request to get the next page of results. |
| \`totalCount\` | The total number of records available. |
`,
	identifier: "PaginationMetadata",
});
export type PaginationMetadata = typeof PaginationMetadata.Type;
