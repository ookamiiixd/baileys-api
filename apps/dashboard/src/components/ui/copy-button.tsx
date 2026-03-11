import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "./button";
import { Spinner } from "./spinner";

const LOADING_DURATION = 1000;
const RESULT_DURATION = 2_000;

type Status = "idle" | "loading" | "success" | "error";

const ICONS: Record<Status, React.ReactElement> = {
	idle: <CopyIcon />,
	loading: <Spinner />,
	success: <CheckIcon className="text-green-600" />,
	error: <XIcon className="text-destructive" />,
};

interface CopyButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
	onCopy: () => string;
}

export function CopyButton({ onCopy, children, ...props }: CopyButtonProps) {
	const [status, setStatus] = useState<Status>("idle");
	const loadingIdRef = useRef<NodeJS.Timeout>(null);
	const resetIdRef = useRef<NodeJS.Timeout>(null);

	const handleClick = useCallback(async () => {
		if (loadingIdRef.current) {
			clearTimeout(loadingIdRef.current);
		}
		if (resetIdRef.current) {
			clearTimeout(resetIdRef.current);
		}
		if (status === "loading") {
			return;
		}

		setStatus("loading");
		loadingIdRef.current = setTimeout(async () => {
			try {
				const text = onCopy();
				await navigator.clipboard.writeText(text);
				setStatus("success");
			} catch {
				setStatus("error");
			}
		}, LOADING_DURATION);

		resetIdRef.current = setTimeout(() => {
			setStatus("idle");
		}, LOADING_DURATION + RESULT_DURATION);
	}, [status, onCopy]);

	return (
		<Button type="button" {...props} onClick={handleClick} disabled={status === "loading"}>
			{ICONS[status]}
			{children}
		</Button>
	);
}
