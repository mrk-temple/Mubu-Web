import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;

const quietIn = {
  initial: { opacity: 0, scale: 0.98, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.98, filter: "blur(4px)" },
  transition: { duration: 0.18, ease: [0.22, 0.61, 0.36, 1] as const },
};

/** 居中浮层：Quick Capture / Command Palette */
export function CenteredOverlay({
  open,
  onOpenChange,
  children,
  className,
  width = "max-w-[560px]",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
  width?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="fixed inset-0 z-[70] bg-scrim backdrop-blur-[2px]"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content forceMount asChild>
              <motion.div
                {...quietIn}
                className={cn(
                  "fixed left-1/2 top-[12vh] z-[71] w-[calc(100vw-32px)] -translate-x-1/2",
                  "rounded-lg border border-line bg-[var(--bg-card)] shadow-lift",
                  width,
                  className,
                )}
              >
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/** 右侧抽屉：Idea Detail */
export function SideDrawer({
  open,
  onOpenChange,
  children,
  width = 440,
  resizer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  /** 像素宽度或任意 CSS 宽度值；配合 resizer 可拖拽伸缩 */
  width?: number | string;
  resizer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="fixed inset-0 z-[60] bg-scrim/40"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content forceMount asChild>
              <motion.aside
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                style={{ width }}
                className={cn(
                  "fixed right-0 top-0 z-[61] flex h-full max-w-full flex-col",
                  "border-l border-line bg-[var(--bg-raised)] shadow-panel",
                )}
              >
                {children}
                {resizer}
              </motion.aside>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-[5px] border border-line bg-[var(--bg-hover)] px-1 font-sans text-[11px] font-medium text-faint">
      {children}
    </kbd>
  );
}
