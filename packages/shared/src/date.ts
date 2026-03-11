const TIME_DIVISIONS = [
	{ amount: 60, name: "seconds" },
	{ amount: 60, name: "minutes" },
	{ amount: 24, name: "hours" },
	{ amount: 7, name: "days" },
	{ amount: 4.34524, name: "weeks" },
	{ amount: 12, name: "months" },
	{ amount: Number.POSITIVE_INFINITY, name: "years" },
] satisfies { amount: number; name: Intl.RelativeTimeFormatUnit }[];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
	numeric: "auto",
});

export function formatRelativeTime(date: string | Date) {
	let duration = (new Date(date).getTime() - Date.now()) / 1000;

	for (let i = 0; i < TIME_DIVISIONS.length; i++) {
		const division = TIME_DIVISIONS[i];
		if (!division) {
			throw new Error("Invalid date");
		}

		if (Math.abs(duration) < division.amount) {
			return relativeTimeFormatter.format(Math.round(duration), division.name);
		}
		duration /= division.amount;
	}
	throw new Error("Invalid date");
}
