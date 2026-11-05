import { ArrowRight, FolderOpen, Link2, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AutoTextarea,
  Button,
  DialogClose,
  DialogTitle,
  PanelResizer,
  SectionLabel,
  SideDrawer,
} from "@/components/ui";
import { RELATION_OPTIONS } from "./QuickCapture";
import { useDebounced, useMediaQuery } from "@/hooks";
import { fullDate, relativeTime } from "@/lib/time";
import { neighborsOf } from "@/lib/selectors";
import { cn } from "@/lib/cn";
import type { Connection, ConnectionType, Idea, Topic } from "@/types";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
import { createLocalSuggestionProvider, type SuggestionResult } from "@/lib/suggestions";

const RELATION_LABEL: Record<ConnectionType, string> = {
  related: "相关",
  inspired: "启发",
  supports: "支持",
  conflicts: "冲突",
  extends: "延伸",
  source: "来源",
};

export const DETAIL_MIN = 320;
export const DETAIL_MAX = 720;

export function IdeaDetailDrawer() {
  const activeId = useUI((s) => s.activeIdeaId);
  const openIdea = useUI((s) => s.openIdea);
  const detailWidth = useUI((s) => s.detailWidth);
  const setDetailWidth = useUI((s) => s.setDetailWidth);
  const ideas = useWorkspace((s) => s.ideas);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const idea = useMemo(() => ideas.find((i) => i.id === activeId) ?? null, [ideas, activeId]);

  return (
    <SideDrawer
      open={!!idea}
      onOpenChange={(v) => !v && openIdea(null)}
      width={isDesktop ? detailWidth : "100%"}
      resizer={
        isDesktop ? (
          <PanelResizer
            side="right"
            width={detailWidth}
            min={DETAIL_MIN}
            max={DETAIL_MAX}
            narrow={DETAIL_MIN}
            wide={DETAIL_MAX}
            label="调整详情栏宽度"
            onWidthChange={setDetailWidth}
          />
        ) : null
      }
    >
      {idea ? <IdeaDetail key={idea.id} idea={idea} /> : null}
    </SideDrawer>
  );
}

function IdeaDetail({ idea }: { idea: Idea }) {
  const updateIdea = useWorkspace((s) => s.updateIdea);
  const deleteIdea = useWorkspace((s) => s.deleteIdea);
  const toggleFavorite = useWorkspace((s) => s.toggleFavorite);
  const createConnection = useWorkspace((s) => s.createConnection);
  const deleteConnection = useWorkspace((s) => s.deleteConnection);
  const updateConnection = useWorkspace((s) => s.updateConnection);
  const topics = useWorkspace((s) => s.topics);
  const projects = useWorkspace((s) => s.projects);
  const connections = useWorkspace((s) => s.connections);
  const ideas = useWorkspace((s) => s.ideas);
  const toggleProjectIdea = useWorkspace((s) => s.toggleProjectIdea);
  const openIdea = useUI((s) => s.openIdea);
  const toast = useUI((s) => s.toast);

  const [title, setTitle] = useState(idea.title ?? "");
  const [content, setContent] = useState(idea.content);
  const [tagInput, setTagInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [saved, setSaved] = useState(true);

  const debouncedContent = useDebounced(content, 500);
  const debouncedTitle = useDebounced(title, 500);

  useEffect(() => {
    if (debouncedContent === idea.content && (debouncedTitle || undefined) === idea.title) return;
    setSaved(false);
    void updateIdea(idea.id, {
      content: debouncedContent,
      title: debouncedTitle.trim() ? debouncedTitle.trim() : undefined,
    }).then(() => setSaved(true));
  }, [debouncedContent, debouncedTitle, idea.content, idea.title, idea.id, updateIdea]);

  const neighbors = useMemo(
    () => neighborsOf(idea.id, ideas, connections),
    [idea.id, ideas, connections],
  );

  const suggestions = useSuggestions(idea.id, ideas, connections, topics);

  const topicNames = idea.topicIds
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t || idea.tags.includes(t)) return setTagInput("");
    void updateIdea(idea.id, { tags: [...idea.tags, t] });
    setTagInput("");
  };

  const linkCandidates = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    return ideas
      .filter((i) => i.id !== idea.id)
      .filter((i) => !neighbors.some((n) => n.idea.id === i.id))
      .filter((i) =>
        !q ||
        (i.title ?? i.content).toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [ideas, linkQuery, idea.id, neighbors]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <span className="text-[11.5px] text-faint">
          {saved ? "已保存" : "保存中…"}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={idea.favorite ? "取消收藏" : "收藏"}
            onClick={() => void toggleFavorite(idea.id)}
          >
            <Star
              size={14}
              strokeWidth={1.5}
              className={idea.favorite ? "fill-current text-accent" : ""}
            />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="连接到其他想法"
            onClick={() => setLinking((v) => !v)}
          >
            <Link2 size={14} strokeWidth={1.5} />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="删除"
            onClick={() => {
              void deleteIdea(idea.id);
              openIdea(null);
              toast("已删除", "quiet");
            }}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </Button>
          <DialogClose asChild>
            <Button size="icon-sm" variant="ghost" aria-label="关闭">
              <X size={15} strokeWidth={1.5} />
            </Button>
          </DialogClose>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <DialogTitle className="sr-only">{idea.title ?? "想法详情"}</DialogTitle>

        {/* 标题用自动增高的 textarea：input 不换行，长标题会被裁掉看不见 */}
        <AutoTextarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给它一个标题（可选）"
          aria-label="标题"
          minRows={1}
          className="text-[19px] font-medium leading-[1.45] tracking-[-0.01em] text-fg placeholder:text-faint/70"
        />

        <AutoTextarea
          data-testid="idea-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-label="正文"
          placeholder="写点什么……"
          minRows={4}
          className="mt-3 text-[14.5px] leading-[1.8] text-fg placeholder:text-faint/70"
        />

        {linking ? (
          <div className="mt-4 rounded-lg border border-line bg-[var(--bg-card)] p-3">
            <div className="flex items-center gap-2">
              <SectionLabel>连接到</SectionLabel>
              <input
                autoFocus
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
                placeholder="搜索想法…"
                className="flex-1 bg-transparent text-[13px] text-fg placeholder:text-faint focus:outline-none"
              />
              <Button size="icon-sm" variant="ghost" aria-label="取消" onClick={() => setLinking(false)}>
                <X size={13} strokeWidth={1.5} />
              </Button>
            </div>
            <ul className="mt-2 flex flex-col">
              {linkCandidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      await createConnection({ sourceId: idea.id, targetId: c.id });
                      setLinking(false);
                      setLinkQuery("");
                      toast("连接已建立", "quiet");
                    }}
                    className="w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] text-muted quiet-hover hover:text-fg"
                  >
                    {c.title ?? c.content.split("\n")[0]}
                  </button>
                </li>
              ))}
              {linkCandidates.length === 0 ? (
                <li className="px-2 py-2 text-[12.5px] text-faint">没有匹配的想法</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <Divider />

        <section>
          <SectionLabel>相关想法</SectionLabel>
          <p className="mt-1 text-[12.5px] text-faint">
            {neighbors.length} 条连接
          </p>
          <ul className="mt-2.5 flex flex-col gap-1">
            {neighbors.map(({ idea: other, connection }) => (
              <li key={connection.id}>
                <ConnectionRow
                  connection={connection}
                  other={other}
                  onOpen={() => openIdea(other.id)}
                  onDelete={() => {
                    void deleteConnection(connection.id);
                    toast("已断开", "quiet");
                  }}
                  onNote={(note) => void updateConnection(connection.id, { note })}
                  onType={(type) => void updateConnection(connection.id, { type })}
                />
              </li>
            ))}
            {neighbors.length === 0 ? (
              <li className="py-1 text-[13px] text-faint">
                还没有连接。点右上角的链接图标，把它和别的想法连起来。
              </li>
            ) : null}
          </ul>

          {suggestions.length > 0 ? (
            <div className="mt-6">
              <SectionLabel>可能的连接</SectionLabel>
              <ul className="mt-2 flex flex-col gap-1">
                {suggestions.map((s) => (
                  <li key={s.ideaId}>
                    <SuggestionRow suggestion={s} onConnect={async () => {
                      await createConnection({ sourceId: idea.id, targetId: s.ideaId });
                      toast("连接已建立", "quiet");
                    }} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-faint">
                基于标签与主题的本地推测，之后可换成语义检索。
              </p>
            </div>
          ) : null}
        </section>

        <Divider />

        <section>
          <SectionLabel>所属项目</SectionLabel>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {projects.map((p) => {
              const active = idea.projectIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => void toggleProjectIdea(p.id, idea.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12.5px] quiet-hover",
                      active
                        ? "border-solid border-accent-line bg-[var(--accent-soft)] text-accent"
                        : "border-dashed border-line text-faint hover:text-muted",
                    )}
                  >
                    <FolderOpen size={12} strokeWidth={1.5} />
                    {p.name}
                  </button>
                </li>
              );
            })}
            {projects.length === 0 ? (
              <li className="text-[13px] text-faint">还没有项目</li>
            ) : null}
          </ul>
        </section>

        <Divider />

        <section>
          <SectionLabel>标签</SectionLabel>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {idea.tags.map((t) => (
              <span
                key={t}
                className="group inline-flex items-center gap-1 rounded-full bg-[var(--bg-hover)] px-2.5 py-0.5 text-[12px] text-muted"
              >
                #{t}
                <button
                  type="button"
                  aria-label={`移除 ${t}`}
                  onClick={() =>
                    void updateIdea(idea.id, { tags: idea.tags.filter((x) => x !== t) })
                  }
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={11} strokeWidth={1.8} />
                </button>
              </span>
            ))}
            {topicNames.map((t) => (
              <span
                key={t!.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted"
              >
                <span
                  className="h-[3px] w-[3px] rounded-full"
                  style={{ background: t!.color ?? "var(--fg-faint)" }}
                />
                {t!.name}
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="+ tag"
              aria-label="添加标签"
              className="w-20 bg-transparent text-[12px] text-fg placeholder:text-faint focus:outline-none"
            />
          </div>
        </section>

        <Divider />

        <dl className="grid grid-cols-[64px_1fr] gap-y-2 text-[12.5px] text-muted">
          <dt className="text-faint">创建于</dt>
          <dd>{fullDate(idea.createdAt)}</dd>
          <dt className="text-faint">更新于</dt>
          <dd>{relativeTime(idea.updatedAt)}</dd>
          {idea.source ? (
            <>
              <dt className="text-faint">来源</dt>
              <dd>
                {idea.source.url ? (
                  <a
                    href={idea.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    {idea.source.title ?? idea.source.url}
                    <ArrowRight size={11} strokeWidth={1.5} />
                  </a>
                ) : (
                  (idea.source.title ?? idea.source.type)
                )}
              </dd>
            </>
          ) : null}
        </dl>
      </div>
    </>
  );
}

function Divider() {
  return <div className="my-6 h-px bg-[var(--line)]" />;
}

function ConnectionRow({
  connection,
  other,
  onOpen,
  onDelete,
  onNote,
  onType,
}: {
  connection: Connection;
  other: Idea;
  onOpen: () => void;
  onDelete: () => void;
  onNote: (note: string) => void;
  onType: (type: ConnectionType | undefined) => void;
}) {
  const [note, setNote] = useState(connection.note ?? "");
  const [editing, setEditing] = useState(false);

  return (
    <div className="group rounded-md px-2 py-1.5 quiet-hover">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 truncate text-left text-[13.5px] text-fg hover:underline"
        >
          → {other.title ?? other.content.split("\n")[0]}
        </button>
        <select
          value={connection.type ?? ""}
          onChange={(e) => onType((e.target.value || undefined) as ConnectionType | undefined)}
          aria-label="关系类型"
          className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[11.5px] text-faint hover:border-line focus:outline-none"
        >
          <option value="">关系</option>
          {RELATION_OPTIONS.filter((r) => r.value !== "custom").map((r) => (
            <option key={r.value} value={r.value}>
              {RELATION_LABEL[r.value as ConnectionType]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          aria-label="断开连接"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X size={12} strokeWidth={1.6} className="text-faint" />
        </button>
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            onNote(note);
            setEditing(false);
          }}
          rows={2}
          placeholder="为什么我当时把它们连起来？"
          className="mt-1.5 w-full resize-none rounded-md border border-line bg-[var(--bg-card)] px-2 py-1.5 text-[12.5px] leading-relaxed text-muted focus:outline-none"
        />
      ) : connection.note ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 block w-full text-left text-[12.5px] leading-relaxed text-muted hover:text-fg"
        >
          {connection.note}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 text-[12px] text-faint opacity-0 transition-opacity group-hover:opacity-100"
        >
          为什么当时把它们连起来？
        </button>
      )}
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onConnect,
}: {
  suggestion: SuggestionResult;
  onConnect: () => void;
}) {
  const ideas = useWorkspace((s) => s.ideas);
  const openIdea = useUI((s) => s.openIdea);
  const other = ideas.find((i) => i.id === suggestion.ideaId);
  if (!other) return null;

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 quiet-hover">
      <button
        type="button"
        onClick={() => openIdea(other.id)}
        className="flex-1 truncate text-left text-[13px] text-muted hover:text-fg"
      >
        {other.title ?? other.content.split("\n")[0]}
      </button>
      <span className="tabular-nums text-[11.5px] text-faint">
        {Math.round(suggestion.score * 100)}%
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="建立连接"
        onClick={onConnect}
        className="opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Plus size={13} strokeWidth={1.5} />
      </Button>
    </div>
  );
}

/** 关系建议的 hook：现在跑本地启发式，之后换 provider 即可 */
function useSuggestions(
  ideaId: string,
  ideas: Idea[],
  connections: Connection[],
  topics: Topic[],
): SuggestionResult[] {
  const [results, setResults] = useState<SuggestionResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    const provider = createLocalSuggestionProvider({
      getIdeas: () => ideas,
      getTopics: () => topics,
      getConnections: () => connections,
      getLinkedIds: (id) =>
        connections
          .filter((c) => c.sourceId === id || c.targetId === id)
          .map((c) => (c.sourceId === id ? c.targetId : c.sourceId)),
    });
    void provider.suggest(ideaId, 4).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [ideaId, ideas, connections, topics]);

  return results;
}

export { RELATION_LABEL };
