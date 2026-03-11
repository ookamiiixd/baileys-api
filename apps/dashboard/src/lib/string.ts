export function getInitials(input: string) {
	const words = input.split(" ");
	if (!words[0]) {
		return "";
	}

	const first = words[0].charAt(0).toUpperCase();
	if (words.length === 1) {
		return first;
	}

	const last = words.at(-1);
	if (!last) {
		return first;
	}

	return first + last.charAt(0).toUpperCase();
}
