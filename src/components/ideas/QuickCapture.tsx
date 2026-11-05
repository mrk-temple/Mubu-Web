import { useEffect, useRef, useState } from "react";
import { CenteredOverlay, DialogTitle, DialogDescription, Kbd } from "@/components/ui";
import { parseCapture, randomPlaceholder } from "@/lib/capture";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
import { createId } from "@/lib/id";
import { shortcutLabel } from "@/lib/shortcut";
import { cn } from "@/lib/cn";
import type { ConnectionType } from "@/types";

const RELATION_OPTIONS: Array<{ value: ConnectionType | "custom"; label: string }> = [
  { value: "extends", label: "延伸" },
  { value: "inspired", label: "启发" },
  { value: "supports", label: "支持" },
  { value: "conflicts", label: "冲突" },
  { value: "source", label: "来源" },
  { value: "related", label: "相关" },
];

/**
 * Quick Capture —— 产品的核心指标是「3 秒内记下一个想法」。
 * 因此：自动聚焦、Enter 保存、Esc 关闭，没有多余的表单项。
 */
export function QuickCapture() {
  const open = useUI((s) => s.quickCaptureOpen);
  const seed = useUI((s) => s.quickCaptureSeed);
  const close = useUI((s) => s.closeQuickCapture);
  const toast = useUI((s) => s.toast);
  const createIdea = useWorkspace((s) => s.createIdea);

  const [value, setValue] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [linkLabel, setLinkLabel] = useState<string | null>(null);
  const [connectTo, setConnectTo] = useState<{ id: string; title: string } | null>(null);
  const [relation, setRelation] = useState<ConnectionType | "">("");
  const [placeholder] = useState(() => randomPlaceholder());
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(seed);
      setTags([]);
      setLinkLabel(null);
      setRelation("");
      window.setTimeout(() => ref.current?.focus(), 30);
    }
  }, [open, seed]);

  const parsed = parseCapture(value);

  const save = async (after?: "close" | "stay") => {
    const data = parseCapture(value);
    if (!data.content.trim()) return;
    const idea = await createIdea({
      content: data.content,
      title: data.title,
      tags: data.tags,
      source: data.source,
    });
    if (connectTo) {
      await useWorkspace.getState().createConnection({
        sourceId: connectTo.id,
        targetId: idea.id,
        type: relation || undefined,
      });
    }
    toast(connectTo ? "连接已建立" : "想法已记录", "quiet");
    setValue("");
    setTags([]);
    setLinkLabel(null);
    setConnectTo(null);
    setRelation("");
    if (after !== "stay") close();
  };

  return (
    <CenteredOverlay open={open} onOpenChange={(v) => !v && close()} width="max-w-[520px]">
      <DialogTitle className="sr-only">快速记录</DialogTitle>
      <DialogDescription className="sr-only">
        输入一个想法，按回车保存。
      </DialogDescription>

      <div className="px-5 pt-5">
        <p className="text-[12px] tracking-[0.04em] text-faint">刚刚想到什么？</p>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            const p = parseCapture(next);
            setTags(p.tags);
            setLinkLabel(p.source?.title ?? null);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void save();
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void save("stay");
            }
          }}
          rows={3}
          data-testid="quick-capture"
          placeholder={placeholder}
          className={cn(
            "mt-2 w-full resize-none bg-transparent text-[17px] leading-[1.65] text-fg",
            "placeholder:text-faint focus:outline-none",
          )}
        />
      </div>

      {connectTo ? (
        <div className="mx-5 mt-1 rounded-md border border-line bg-[var(--bg-raised)] px-3 py-2.5">
          <p className="text-[12px] text-muted">
            将与「{connectTo.title}」连接
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {RELATION_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRelation(relation === r.value ? "" : (r.value as ConnectionType))}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[12px] quiet-hover",
                  relation === r.value
                    ? "border-accent-line bg-[var(--accent-soft)] text-accent"
                    : "border-line text-muted",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-faint">关系不是必填的。</p>
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-3 border-t border-line px-5 py-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 text-[12px] text-faint">
          {tags.length === 0 && !linkLabel ? (
            <>
              <span>#tag</span>
              <span className="text-faint/60">·</span>
              <span>+ Link</span>
              <span className="text-faint/60">·</span>
              <span>粘贴网址会自动记为来源</span>
            </>
          ) : (
            <>
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11.5px] text-accent"
                >
                  #{t}
                </span>
              ))}
              {linkLabel ? (
                <span className="text-[11.5px]">来源 · {linkLabel}</span>
              ) : null}
              {parsed.title ? (
                <span className="text-[11.5px] text-faint">标题已识别</span>
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-faint">
            <Kbd>{shortcutLabel("↵")}</Kbd> 存下继续
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!value.trim()}
            className="rounded-md bg-accent px-3 py-1 text-[13px] font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            存下 <Kbd>↵</Kbd>
          </button>
        </div>
      </div>
    </CenteredOverlay>
  );
}

export function newDraftId() {
  return createId("draft");
}

export { RELATION_OPTIONS };
