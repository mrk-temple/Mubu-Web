import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";
import { cn } from "@/lib/cn";

export const Menu = DropdownPrimitive.Root;
export const MenuTrigger = DropdownPrimitive.Trigger;

export function MenuContent({
  children,
  align = "end",
  side = "bottom",
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        side={side}
        sideOffset={6}
        className={cn(
          "z-[80] min-w-[180px] rounded-lg border border-line bg-[var(--bg-card)] p-1 shadow-lift",
          className,
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  hint,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        "flex cursor-pointer select-none items-center justify-between gap-6 rounded-md px-2.5 py-1.5 text-[13px]",
        "outline-none data-[highlighted]:bg-[var(--bg-hover)]",
        danger ? "text-[#a15c53]" : "text-fg",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <span>{children}</span>
      {hint ? <span className="text-[11px] text-faint">{hint}</span> : null}
    </DropdownPrimitive.Item>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownPrimitive.Label className="px-2.5 py-1.5 text-[11px] uppercase tracking-[0.08em] text-faint">
      {children}
    </DropdownPrimitive.Label>
  );
}

export function MenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-[var(--line)]" />;
}
