import { Buffer } from "node:buffer";
import {
	type Decode as BaseDecode,
	type BufferEncoded,
	jsonReplacer as baseJsonReplacer,
	jsonReviver as baseJsonReviver,
	type Encode,
} from "@wavvy/shared/codec";

export type Decode<T> = T extends BufferEncoded ? Buffer : BaseDecode<T>;
export type { Encode };

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

function jsonReplacer(this: any, _: string, value: any): any {
	// This won't likely to be happen since `Buffer` implements `toJSON`,
	// but just in case
	if (Buffer.isBuffer(value)) {
		return value.toJSON();
	}

	return baseJsonReplacer.call(this, _, value);
}

function jsonReviver(_: string, value: any): any {
	if (value && typeof value === "object" && value.type && value.type === "Buffer") {
		return Buffer.from(value);
	}

	return baseJsonReviver(_, value);
}
