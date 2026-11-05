import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Command, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { IdeaCard, IdeaHintRow } from "./IdeaCard";
import { Button, EmptyState, IdeaSkeletonList, Kbd } from "@/components/ui";
import { randomPlaceholder, parseCapture } from "@/lib/capture";
import { daysAgoLabel, greeting, relativeTime } from "@/lib/time";
import { useWorkspace } from "@/stores/useWorkspace";
import { useUI } from "@/stores/useUI";
import type { Idea } from "@/types";
import { cn } from "@/lib/cn";

/** 首页：不是 Dashboard，而是「今天我的脑海里发生了什么？」 */
export function TodayView() {
  const ready = useWorkspace((s) => s.ready);
  const ideas = useWorkspace((s) => s.ideas);
  const topics = useWorkspace((s) => s.topics);
  const projects = useWorkspace((s) => s.projects);
  const connections = useWorkspace((s) => s.connections);
  const createIdea = useWorkspace((s) => s.createIdea);
  const toast = useUI((s) => s.toast);
  const openCapture = useUI((s) => s.openQuickCapture);

  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [placeholder] = useState(() => randomPlaceholder());

  const topicName = (id: string) => topics.find((t) => t.id === id)?.name ?? "";
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";

  const todays = useMemo(() => {
    const today = new Date().toDateString();
    return ideas.filter((i) => new Date(i.createdAt).toDateString() === today);
  }, [ideas]);

  const stream = ideas.slice(0, 24);

  const rediscover = useMemo(() => pickRediscover(ideas), [ideas]);

  const save = async () => {
    if (saving) return;
    const parsed = parseCapture(value);
    if (!parsed.content.trim()) return;
    setSaving(true);
    try {
      await createIdea({
        content: parsed.content,
        title: parsed.title,
        tags: parsed.tags,
        source: parsed.source,
      });
      setValue("");
      toast("想法已记录", "quiet");
    } catch {
      toast("保存失败，想法仍保留在输入框里");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <main className="flex-1 overflow-y-auto">
        <div className="mubu-today mx-auto w-full px-5 pb-24 sm:px-8">
          <header className="mubu-intro">
            <div>
              <p className="mubu-eyebrow">{greeting()} · 思考工作室</p>
              <h1>让想法，慢慢成形。</h1>
              <p className="mubu-intro-copy">捕捉一个念头，发现它的连接，再把它整理成作品。</p>
            </div>
            <dl className="mubu-index" aria-label="工作空间统计">
              <div><dt>灵感</dt><dd>{ideas.length.toString().padStart(2, "0")}</dd></div>
              <div><dt>连接</dt><dd>{connections.length.toString().padStart(2, "0")}</dd></div>
              <div><dt>项目</dt><dd>{projects.length.toString().padStart(2, "0")}</dd></div>
            </dl>
          </header>

          <section className="mubu-composer">
            <p className="mubu-eyebrow">01 / 留下此刻</p>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  openCapture(value);
                  setValue("");
                }
              }}
              rows={value ? 4 : 2}
              data-testid="composer"
              placeholder={placeholder}
              aria-label="记录一个想法"
              disabled={saving}
              className={cn(
                "w-full resize-none rounded-lg border border-transparent bg-transparent px-3 py-2.5",
                "text-[16px] leading-[1.7] text-fg placeholder:text-faint",
                "transition-colors duration-150",
                "hover:bg-[var(--bg-card)] focus:border-line focus:bg-[var(--bg-card)] focus:shadow-soft",
                "focus:outline-none",
              )}
            />
            <div className="flex items-center justify-between px-3 pb-1">
              <IdeaHintRow />
              {value.trim() ? (
                <Button size="sm" variant="accent" disabled={saving} onClick={() => void save()}>
                  {saving ? "保存中…" : "保存"} <Kbd>↵</Kbd>
                </Button>
              ) : (
                <span className="text-[12.5px] text-faint">
                  #标签 · 链接会被识别
                </span>
              )}
            </div>
          </section>

          <div className="mt-6 mb-4 flex items-baseline justify-between border-t border-line pt-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-faint">
              {todays.length > 0 ? `今天 · ${todays.length}` : "最近"}
            </p>
            <button
              type="button"
              onClick={() => openCapture()}
              className="rounded-md px-2 py-0.5 text-[12.5px] text-faint quiet-hover hover:text-fg"
            >
              <span className="inline-flex items-center gap-1.5">
                <Command size={12} strokeWidth={1.5} /> 快速记录
              </span>
            </button>
          </div>

          {!ready ? (
            <IdeaSkeletonList count={4} />
          ) : stream.length === 0 ? (
            <EmptyState
              title="这里还很安静。"
              body="记录第一个想法，思想网络会慢慢生长。"
              action={
                <Button variant="accent" size="md" onClick={() => openCapture()}>
                  记录想法
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {stream.map((idea, idx) => (
                  <div key={idea.id}>
                    <IdeaCard
                      idea={idea}
                      topicNames={idea.topicIds.map(topicName).filter(Boolean)}
                      projectNames={idea.projectIds.map(projectName).filter(Boolean)}
                    />
                    {idx === 3 && rediscover ? (
                      <RediscoverCard idea={rediscover} connections={connections.length} />
                    ) : null}
                    <div className="mx-3 h-px bg-[var(--line)] last:hidden" />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </>
  );
}


function pickRediscover(ideas: Idea[]): Idea | null {
  const old = ideas.filter((i) => {
    const days = (Date.now() - new Date(i.createdAt).getTime()) / 86_400_000;
    return days > 30;
  });
  const pool = old.length > 0 ? old : ideas;
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * Rediscover —— 让旧想法重新进入视野。
 * 回顾不该是任务，而是随手翻到一页。
 */
export function RediscoverCard({ idea, connections }: { idea: Idea; connections: number }) {
  const openIdea = useUI((s) => s.openIdea);
  const [current, setCurrent] = useState(idea);
  const ideas = useWorkspace((s) => s.ideas);

  const line =
    current.title ??
    current.content.split("\n").find((l) => l.trim())?.slice(0, 42) ??
    "";

  return (
    <motion.aside
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.3 }}
      className="my-6 rounded-lg border border-line bg-[var(--bg-raised)] px-5 py-5"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-faint">
        <Sparkles size={12} strokeWidth={1.5} />
        <span>From {daysAgoLabel(current.createdAt)}</span>
      </div>
      <p className="editorial mt-3 text-[17px] leading-[1.6] text-fg">
        “{line}”
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11.5px] text-faint">
          {relativeTime(current.createdAt)} · {connections} 条连接散在各处
        </span>
        <button
          type="button"
          onClick={() => {
            const pick = pickRediscover(ideas.filter((i) => i.id !== current.id));
            if (pick) setCurrent(pick);
            else openIdea(current.id);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-accent quiet-hover hover:bg-[var(--accent-soft)]"
        >
          Rediscover <ArrowRight size={13} strokeWidth={1.5} />
        </button>
      </div>
    </motion.aside>
  );
}

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("flex-1 overflow-y-auto", className)}>
      <div className="mubu-page mx-auto w-full px-5 pb-24 pt-8 sm:px-8">
        {children}
      </div>
    </main>
  );
}
