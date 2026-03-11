import { ParseResult, Schema as S } from "effect";

export const Timestamps = S.Struct({
	recordCreatedAt: S.DateTimeUtc.annotations({
		description: "The timestamp when the record was created in UTC.",
	}),
	recordUpdatedAt: S.DateTimeUtc.annotations({
		description: "The timestamp when the record was last updated in UTC.",
	}),
});

export const ArrayFromString = S.transform(S.String, S.Array(S.String), {
	strict: true,
	decode: (value) =>
		value
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0),
	encode: (value) => value.join(","),
}).annotations({
	description: "An array of strings represented as a comma-separated string.",
	identifier: "ArrayFromString",
});
export type ArrayFromString = typeof ArrayFromString.Type;

export const RecordFromJsonString = S.transformOrFail(
	S.String,
	S.Record({ key: S.String, value: S.Any }),
	{
		strict: true,
		decode: (value, _, ast) => {
			try {
				return ParseResult.succeed(JSON.parse(value));
			} catch {
				return ParseResult.fail(
					new ParseResult.Type(ast, value, "An error occurred while parsing the JSON string."),
				);
			}
		},
		encode: (value, _, ast) => {
			try {
				return ParseResult.succeed(JSON.stringify(value));
			} catch {
				return ParseResult.fail(
					new ParseResult.Type(ast, value, "An error occurred while stringifying the record."),
				);
			}
		},
	},
);
export type RecordFromJsonString = typeof RecordFromJsonString.Type;

export interface RecordFromDatabase {
	recordId: number;
	recordCreatedAt: Date;
	recordUpdatedAt: Date;
}
