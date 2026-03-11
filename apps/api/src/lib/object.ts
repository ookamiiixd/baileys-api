export function pick<T extends Record<string, any>, K extends keyof T>(
	obj: T,
	...keys: K[]
): Pick<T, K> {
	const clone = {} as Pick<T, K>;
	for (const key of keys) {
		clone[key] = obj[key];
	}
	return clone;
}

export function omit<T extends Record<string, any>, K extends keyof T>(
	obj: T,
	...keys: K[]
): Omit<T, K> {
	const clone = { ...obj };
	for (const key of keys) {
		delete clone[key];
	}
	return clone;
}
