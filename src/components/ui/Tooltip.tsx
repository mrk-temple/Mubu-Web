import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  label,
  hint,
  side = "right",
  align = "center",
  children,
}: {
  label: string;
  hint?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root delayDuration={260}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={7}
          className={cn(
            "z-[80] flex items-center gap-2 rounded-md border border-line",
            "bg-[var(--bg-card)] px-2 py-1 text-[12px] leading-tight text-fg",
            "shadow-soft",
            "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in",
          )}
        >
          <span>{label}</span>
          {hint ? (
            <kbd className="font-sans text-[11px] text-faint">{hint}</kbd>
          ) : null}
          <TooltipPrimitive.Arrow className="fill-[var(--bg-card)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
