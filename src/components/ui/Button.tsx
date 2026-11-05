import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "ghost" | "quiet" | "outline" | "accent";
type Size = "sm" | "md" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  ghost:
    "bg-transparent text-muted hover:bg-[var(--bg-hover)] hover:text-fg",
  quiet:
    "bg-[var(--bg-hover)] text-fg hover:bg-[var(--bg-active)]",
  outline:
    "border border-line text-fg hover:bg-[var(--bg-hover)]",
  accent:
    "bg-accent text-[var(--bg-card)] hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5",
  md: "h-8 px-3 text-[13.5px] gap-2",
  icon: "h-8 w-8 justify-center",
  "icon-sm": "h-7 w-7 justify-center",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "ghost", size = "md", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex select-none items-center rounded-md font-medium quiet-hover",
          "disabled:pointer-events-none disabled:opacity-40",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      />
    );
  },
);
