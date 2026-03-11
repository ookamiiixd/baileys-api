import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useEffect } from "react";

type Theme = "dark" | "light" | "system";

export const themeAtom = atomWithStorage<Theme>("@wavvy/theme", "system", undefined, {
	getOnInit: true,
});

export function useApplyTheme() {
	const [theme] = useAtom(themeAtom);

	useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");

		if (theme === "system") {
			const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";

			root.classList.add(systemTheme);
			return;
		}

		root.classList.add(theme);
	}, [theme]);
}
