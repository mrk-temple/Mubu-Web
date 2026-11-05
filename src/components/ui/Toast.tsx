import { AnimatePresence, motion } from "framer-motion";
import { useUI } from "@/stores/useUI";
import { cn } from "@/lib/cn";

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 4, filter: "blur(3px)" }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn(
              "pointer-events-auto rounded-full border border-line bg-[var(--bg-card)]",
              "px-3.5 py-1.5 text-[12.5px] text-fg shadow-soft",
              t.tone === "quiet" && "text-muted",
            )}
          >
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--bg-hover)]",
        className ?? "h-4 w-full",
      )}
    />
  );
}

export function IdeaSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <Skeleton className="h-3.5 w-[68%]" />
          <Skeleton className="h-3.5 w-[92%]" />
          <Skeleton className="h-3.5 w-[34%]" />
        </div>
      ))}
    </div>
  );
}
