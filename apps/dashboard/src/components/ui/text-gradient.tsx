import * as React from "react";
import { cn } from "~/lib/utils";

type CSSVariableStyle = React.CSSProperties & {
	"--spread"?: string;
};

interface TextGradientProps extends React.HTMLAttributes<HTMLSpanElement> {
	children: React.ReactNode;
	/**
	 * The spread distance for the gradient effect in pixels
	 * @default 22
	 */
	spread?: number;
	/**
	 * The background color for the gradient highlight
	 * Can be a CSS variable or any valid CSS color
	 * @default "hsl(var(--background))"
	 */
	highlightColor?: string;
	/**
	 * The base text color (shows through the gradient)
	 * Can be a CSS variable or any valid CSS color
	 * @default "hsl(var(--muted-foreground))"
	 */
	baseColor?: string;
	/**
	 * Animation duration in seconds
	 * @default 3
	 */
	duration?: number;
}

const TextGradient = React.forwardRef<HTMLSpanElement, TextGradientProps>(
	(
		{
			children,
			className,
			spread = 22,
			highlightColor = "var(--background)",
			baseColor = "var(--muted-foreground)",
			duration = 2,
			style,
			...props
		},
		ref,
	) => {
		const inlineStyle: CSSVariableStyle = {
			"--spread": `${spread}px`,
			...style,
			backgroundImage: `linear-gradient(90deg, transparent calc(50% - var(--spread)), ${highlightColor} 50%, transparent calc(50% + var(--spread))), linear-gradient(${baseColor}, ${baseColor})`,
			backgroundSize: "250% 100%, 100% 100%",
			animation: `text-gradient-shift ${duration}s linear infinite`,
		};

		return (
			<span
				ref={ref}
				className={cn(
					"relative inline-block bg-clip-text text-transparent",
					"[background-repeat:no-repeat,padding-box]",
					className,
				)}
				style={inlineStyle}
				{...props}
			>
				<style>
					{`
            @keyframes text-gradient-shift {
              from { background-position: 100% center; }
              to { background-position: 0% center; }
            }
          `}
				</style>
				{children}
			</span>
		);
	},
);

TextGradient.displayName = "TextGradient";

export { TextGradient };
