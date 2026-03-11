import { useAtom } from "jotai";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { themeAtom } from "~/lib/theme";

export function ThemeToggle() {
	const [theme, setTheme] = useAtom(themeAtom);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="icon">
						<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
						<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
						<span className="sr-only">Toggle theme</span>
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
					<DropdownMenuRadioItem value="light" closeOnClick>
						<Sun className="size-4" />
						Light
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="dark" closeOnClick>
						<Moon className="size-4" />
						Dark
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="system" closeOnClick>
						<Monitor className="size-4" />
						System
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
