export type MakeNonNullable<T, K extends keyof T> = T & {
	[P in K]-?: NonNullable<T[P]>;
};

export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
	[P in K]?: T[P];
};

export type DeepMutable<T> =
	T extends ReadonlyArray<infer Item>
		? Array<DeepMutable<Item>>
		: T extends Record<string, unknown>
			? { -readonly [K in keyof T]: DeepMutable<T[K]> }
			: T;
