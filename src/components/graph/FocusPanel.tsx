import { motion } from "framer-motion";
import { ChevronRight, ExternalLink, FolderOpen, ScanSearch, X } from "lucide-react";
import { useMemo } from "react";
import { Button, SectionLabel, Tooltip } from "@/components/ui";
import { neighborsOf } from "@/lib/selectors";
import { fullDate, relativeTime } from "@/lib/time";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
import { cn } from "@/lib/cn";

/**
 * Focus Mode 侧栏。
 * 目的不是「展示详情」，而是让人可以顺着连接一直走下去 ——
 * 在自己的思想里漫游。
 */
export function FocusPanel({
  ideaId,
  onClose,
  onFocusCluster,
  compact = false,
}: {
  ideaId: string;
  onClose: () => void;
  onFocusCluster?: () => void;
  compact?: boolean;
}) {
  const ideas = useWorkspace((s) => s.ideas);
  const connections = useWorkspace((s) => s.connections);
  const projects = useWorkspace((s) => s.projects);
  const setFocusIdea = useUI((s) => s.setFocusIdea);
  const openIdea = useUI((s) => s.openIdea);

  const idea = ideas.find((i) => i.id === ideaId);
  const neighbors = useMemo(
    () => (idea ? neighborsOf(idea.id, ideas, connections) : []),
    [idea, ideas, connections],
  );
  const usedIn = useMemo(
    () => projects.filter((p) => p.ideaIds.includes(ideaId)),
    [projects, ideaId],
  );

  if (!idea) return null;

  return (
    <motion.aside
      initial={{ x: 16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 16, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
      className={cn(
        "flex w-full shrink-0 flex-col border-l border-line bg-[var(--bg-raised)]",
        compact ? "absolute inset-y-0 right-0 z-20 w-[86%] max-w-[340px] shadow-panel" : "w-[320px]",
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-line px-5 py-3">
        <p className="text-[11px] tracking-[0.1em] text-faint">专注阅读</p>
        <div className="flex items-center gap-0.5">
          {onFocusCluster ? (
            <Tooltip label="放大这一系列" side="bottom">
              <Button size="icon-sm" variant="ghost" aria-label="放大这一系列" onClick={onFocusCluster}>
                <ScanSearch size={13} strokeWidth={1.5} />
              </Button>
            </Tooltip>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="打开完整详情"
            onClick={() => openIdea(idea.id)}
          >
            <ExternalLink size={13} strokeWidth={1.5} />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="退出专注" onClick={onClose}>
            <X size={14} strokeWidth={1.5} />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h2 className="text-[16.5px] font-medium leading-[1.5] tracking-[-0.01em] text-fg">
          {idea.title ?? idea.content.split("\n")[0]}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-[1.8] text-muted">
          {(idea.title ? idea.content : idea.content.split("\n").slice(1).join("\n")).trim() ||
            "（还没有更多内容）"}
        </p>

        <div className="my-6 h-px bg-[var(--line)]" />

        <SectionLabel>相关想法</SectionLabel>
        <ul className="mt-2.5 flex flex-col gap-0.5">
          {neighbors.map(({ idea: other, connection }) => (
            <li key={connection.id}>
              <button
                type="button"
                onClick={() => setFocusIdea(other.id)}
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left quiet-hover"
              >
                <ChevronRight
                  size={12}
                  strokeWidth={1.5}
                  className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
                />
                <span className="flex-1 truncate text-[13px] text-muted group-hover:text-fg">
                  {other.title ?? other.content.split("\n")[0]}
                </span>
                {connection.type ? (
                  <span className="shrink-0 text-[10.5px] text-faint">
                    {RELATION[connection.type]}
                  </span>
                ) : null}
              </button>
              {connection.note ? (
                <p className="ml-6 mb-1 text-[11.5px] leading-relaxed text-faint">
                  {connection.note}
                </p>
              ) : null}
            </li>
          ))}
          {neighbors.length === 0 ? (
            <li className="px-2 py-1 text-[12.5px] text-faint">
              还没有连接。从这里开始长出第一条线。
            </li>
          ) : null}
        </ul>

        {usedIn.length > 0 ? (
          <>
            <div className="my-6 h-px bg-[var(--line)]" />
            <SectionLabel>所属项目</SectionLabel>
            <ul className="mt-2 flex flex-col gap-0.5">
              {usedIn.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      useUI.getState().setFocusIdea(null);
                      window.location.assign(`/projects/${p.id}`);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted quiet-hover hover:text-fg"
                  >
                    <FolderOpen size={12} strokeWidth={1.5} className="text-faint" />
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="my-6 h-px bg-[var(--line)]" />

        <dl className="grid grid-cols-[64px_1fr] gap-y-1.5 text-[12px] text-muted">
          <dt className="text-faint">创建于</dt>
          <dd>{fullDate(idea.createdAt)}</dd>
          <dt className="text-faint">更新于</dt>
          <dd>{relativeTime(idea.updatedAt)}</dd>
        </dl>
      </div>
    </motion.aside>
  );
}

const RELATION: Record<string, string> = {
  related: "相关",
  inspired: "启发",
  supports: "支持",
  conflicts: "冲突",
  extends: "延伸",
  source: "来源",
};
