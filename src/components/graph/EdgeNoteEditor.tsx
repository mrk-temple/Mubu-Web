import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { Connection, ConnectionType } from "@/types";

const OPTIONS: Array<{ value: ConnectionType; label: string }> = [
  { value: "related", label: "相关" },
  { value: "inspired", label: "启发" },
  { value: "supports", label: "支持" },
  { value: "conflicts", label: "冲突" },
  { value: "extends", label: "延伸" },
  { value: "source", label: "来源" },
];

/**
 * 点击连线时的轻量编辑器。
 * 核心是那句问话：「为什么我当时把它们连起来？」
 */
export function EdgeNoteEditor({
  connection,
  sourceLabel,
  targetLabel,
  x,
  y,
  onClose,
  onSave,
  onDelete,
}: {
  connection: Connection;
  sourceLabel: string;
  targetLabel: string;
  x: number;
  y: number;
  onClose: () => void;
  onSave: (patch: { type?: ConnectionType; note?: string }) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(connection.note ?? "");
  const [type, setType] = useState<ConnectionType | undefined>(connection.type);

  useEffect(() => {
    setNote(connection.note ?? "");
    setType(connection.type);
  }, [connection.id, connection.note, connection.type]);

  const left = Math.min(Math.max(x - 150, 16), window.innerWidth - 320);
  const top = Math.min(Math.max(y + 10, 16), window.innerHeight - 280);

  return (
    <>
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="fixed inset-0 z-[88] cursor-default bg-transparent"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.16 }}
        style={{ left, top }}
        className="fixed z-[89] w-[300px] rounded-lg border border-line bg-[var(--bg-card)] p-3.5 shadow-lift"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12.5px] font-medium text-fg">
            为什么我当时把它们连起来？
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-0.5 text-faint quiet-hover"
          >
            <X size={13} strokeWidth={1.6} />
          </button>
        </div>
        <p className="mt-1 line-clamp-1 text-[11px] text-faint">
          {sourceLabel} → {targetLabel}
        </p>

        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="写下当时的一点缘由……（可留空）"
          className="mt-2.5 w-full resize-none rounded-md border border-line bg-[var(--bg-raised)] px-2.5 py-2 text-[12.5px] leading-relaxed text-fg placeholder:text-faint focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap gap-1">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setType(type === o.value ? undefined : o.value);
                onSave({
                  type: type === o.value ? undefined : o.value,
                  note,
                });
              }}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11.5px] quiet-hover",
                type === o.value
                  ? "border-accent-line bg-[var(--accent-soft)] text-accent"
                  : "border-line text-muted hover:text-fg",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-[12px] text-faint quiet-hover hover:text-[#a15c53]"
          >
            断开连接
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({ type, note });
              onClose();
            }}
            className="rounded-md bg-accent px-3 py-1 text-[12.5px] font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90"
          >
            保存
          </button>
        </div>
      </motion.div>
    </>
  );
}
