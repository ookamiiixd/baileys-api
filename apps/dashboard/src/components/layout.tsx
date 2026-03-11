import { useAtom } from "jotai";
import { ActivityIcon, ExternalLinkIcon, HeartIcon, KeyRoundIcon } from "lucide-react";
import { authDialogOpenAtom } from "~/components/auth-dialog";
import { authAtom } from "~/lib/auth";
import { httpClientAtom } from "~/lib/http-client";
import githubLogo from "/github.svg";
import { ThemeToggle } from "./theme-toggle";
import { Button, buttonVariants } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="w-full min-h-screen flex flex-col">
			<Header />
			<Main>{children}</Main>
			<Footer />
		</div>
	);
}

export function Header() {
	const [auth] = useAtom(authAtom);
	const [_, setIsAuthDialogOpen] = useAtom(authDialogOpenAtom);

	return (
		<header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
			<div className="max-w-7xl mx-auto p-4 flex gap-4 justify-between">
				<div className="flex items-center gap-3">
					<div className="p-2 rounded text-primary-foreground bg-primary">
						<ActivityIcon className="size-5" />
					</div>
					<h1 className="hidden sm:block text-xl font-bold tracking-tight">Wavvy</h1>
				</div>
				<div className="flex items-center gap-2">
					<ThemeToggle />
					<Button variant="outline" size="icon" onClick={() => setIsAuthDialogOpen(true)}>
						<KeyRoundIcon />
						<span className="sr-only">Update credentials</span>
					</Button>
					<a
						href={`${auth.baseUrl}/docs`}
						target="_blank"
						className={buttonVariants({ variant: "secondary" })}
					>
						<ExternalLinkIcon className="size-4" />
						API Docs
					</a>
				</div>
			</div>
		</header>
	);
}

export function Main({ children }: { children: React.ReactNode }) {
	const [httpClient] = useAtom(httpClientAtom);

	return (
		<main className="flex-1">
			<div className="max-w-7xl mx-auto p-4">{httpClient ? children : null}</div>
		</main>
	);
}

export function Footer() {
	return (
		<footer className="border-t border-border bg-card/50">
			<div className="max-w-7xl mx-auto px-4 py-3">
				<div className="text-xs flex flex-col sm:flex-row items-center justify-between gap-4">
					<p className="text-muted-foreground text-center sm:text-left">
						<span className="font-semibold text-foreground">
							Wavvy <code>v{__WAVVY_VERSION__}</code>
						</span>{" "}
						•{" "}
						<a
							href="https://github.com/ookamiiixd/wavvy/blob/master/LICENSE"
							target="_blank"
							rel="noopener"
						>
							MIT License
						</a>
					</p>
					<div className="flex gap-3">
						<a
							href="https://github.com/ookamiiixd/wavvy"
							target="_blank"
							rel="noopener"
							className="flex gap-1"
						>
							<img src={githubLogo} alt="github logo" className="size-4" />
							Repository
						</a>
						<a
							href="https://github.com/sponsors/ookamiiixd"
							target="_blank"
							rel="noopener"
							className="flex gap-1"
						>
							<HeartIcon className="text-pink-600 size-4" />
							Sponsor
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
