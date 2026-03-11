export function getError(error: unknown) {
	if (error instanceof Error) {
		return error;
	}

	const message = typeof error === "string" ? error : JSON.stringify(error);
	return new Error(message);
}

export function getRootErrorCause(error: unknown): Error {
	const err = getError(error);
	let currentError: Error | undefined = err;

	while (currentError) {
		const cause: unknown = currentError?.cause;
		if (cause instanceof Error) {
			currentError = cause;
		} else {
			break;
		}
	}

	return currentError || err;
}
