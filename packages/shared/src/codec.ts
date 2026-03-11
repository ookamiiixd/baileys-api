import type { Brand } from "effect";
import Long from "long";

export interface BufferEncoded {
	type: "Buffer";
	data: number[];
}

export interface Uint8ArrayEncoded {
	type: "Uint8Array";
	data: number[];
}

export interface LongEncoded {
	type: "Long";
	data: number[];
}

/**
 * Recursively transforms types into their encoded forms
 */
export type Encode<T> = T extends Buffer
	? BufferEncoded
	: T extends Uint8Array
		? Uint8ArrayEncoded
		: T extends Long
			? LongEncoded
			: T extends URL
				? string
				: T extends Brand.Brand<any>
					? ReturnType<typeof Brand.unbranded<T>>
					: T extends Array<infer U>
						? Array<Encode<U>>
						: T extends Record<string, any>
							? { [K in keyof T]: Encode<T[K]> }
							: T;

/**
 * Recursively transforms encoded types back to their original forms
 */
export type Decode<T> = T extends BufferEncoded
	? Uint8Array // Browser doesn't support Buffer
	: T extends Uint8ArrayEncoded
		? Uint8Array
		: T extends LongEncoded
			? Long
			: T extends Array<infer U>
				? Array<Decode<U>>
				: T extends Record<string, any>
					? { [K in keyof T]: Decode<T[K]> }
					: T;

export function encode<T>(value: T) {
	const jsonString = encodeToJson(value);
	return JSON.parse(jsonString) as Encode<T>;
}

export function decode<T>(value: T) {
	const jsonString = JSON.stringify(value);
	return decodeFromJson<T>(jsonString);
}

export function encodeToJson<T>(value: T, space?: string | number) {
	return JSON.stringify(value, jsonReplacer, space);
}

export function decodeFromJson<T>(jsonString: string) {
	return JSON.parse(jsonString, jsonReviver) as Decode<T>;
}

export function jsonReplacer(this: any, _: string, value: any): any {
	if (value instanceof Uint8Array) {
		return {
			type: "Uint8Array",
			data: Array.from(value),
		};
	}

	if (Long.isLong(value)) {
		return {
			type: "Long",
			data: value.toBytes(),
		};
	}

	return value;
}

export function jsonReviver(_: string, value: any): any {
	if (value && typeof value === "object" && value.type) {
		switch (value.type) {
			case "Buffer":
				return new Uint8Array(value.data);
			case "Uint8Array":
				return new Uint8Array(value.data);
			case "Long":
				return Long.fromBytes(value.data);
		}
	}

	return value;
}
