import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { ConnectionType } from "@/types";

export const RELATIONS: Array<{ value: ConnectionType; label: string }> = [
  { value: "extends", label: "延伸" },
  { value: "inspired", label: "启发" },
  { value: "supports", label: "支持" },
  { value: "conflicts", label: "冲突" },
  { value: "source", label: "来源" },
  { value: "related", label: "相关" },
];

export interface PendingLink {
  sourceId: string;
  targetId: string;
  x: number;
  y: number;
  sourceLabel: string;
  targetLabel: string;
}

/**
 * 建立连接时的轻量关系选择。
 * 「为什么连接它们？」—— 可以不答，但留一个回答的入口。
 */
export function RelationPicker({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingLink;
  onConfirm: (type?: ConnectionType, note?: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ConnectionType | undefined>();
  const [custom, setCustom] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setType(undefined);
    setCustom(false);
    setNote("");
  }, [pending.sourceId, pending.targetId]);

  const x = Math.min(Math.max(pending.x - 140, 16), typeof window !== "undefined" ? window.innerWidth - 320 : 800);
  const y = Math.min(Math.max(pending.y + 12, 16), typeof window !== "undefined" ? window.innerHeight - 300 : 600);

  return (
    <>
      <button
        type="button"
        aria-label="取消连接"
        onClick={onCancel}
        className="fixed inset-0 z-[88] cursor-default bg-transparent"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
        style={{ left: x, top: y }}
        className="fixed z-[89] w-[300px] rounded-lg border border-line bg-[var(--bg-card)] p-3.5 shadow-lift"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-medium text-fg">为什么连接它们？</p>
            <p className="mt-1 line-clamp-1 text-[11.5px] text-faint">
              {pending.sourceLabel} → {pending.targetLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭"
            className="rounded-md p-0.5 text-faint quiet-hover"
          >
            <X size={13} strokeWidth={1.6} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {RELATIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setType(type === r.value ? undefined : r.value)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[12px] quiet-hover",
                type === r.value
                  ? "border-accent-line bg-[var(--accent-soft)] text-accent"
                  : "border-line text-muted hover:text-fg",
              )}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustom((v) => !v)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[12px] quiet-hover",
              custom
                ? "border-accent-line bg-[var(--accent-soft)] text-accent"
                : "border-line text-muted hover:text-fg",
            )}
          >
            自定义关系……
          </button>
        </div>

        {custom ? (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="写下这段关系，或只留一句当时的想法"
            className="mt-2.5 w-full rounded-md border border-line bg-[var(--bg-raised)] px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-faint focus:outline-none"
          />
        ) : (
          <p className="mt-2.5 text-[11.5px] text-faint">
            关系不是必填的。也可以只是先连上。
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onConfirm(undefined, custom ? note : undefined)}
            className="rounded-md px-2 py-1 text-[12.5px] text-muted quiet-hover hover:text-fg"
          >
            先不设关系
          </button>
          <button
            type="button"
            onClick={() => onConfirm(type, custom ? note : undefined)}
            className="rounded-md bg-accent px-3 py-1 text-[12.5px] font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90"
          >
            连接
          </button>
        </div>
      </motion.div>
    </>
  );
}
