import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { IdeaCard } from "./IdeaCard";
import { EmptyState, IdeaSkeletonList } from "@/components/ui";
import { searchItems } from "@/lib/search";
import { useWorkspace } from "@/stores/useWorkspace";
import { cn } from "@/lib/cn";
import type { Idea } from "@/types";

export type IdeaFilter = {
  topicId?: string;
  projectId?: string;
  tag?: string;
  favorite?: boolean;
};

/** 统一的想法流：今日 / 主题 / 项目 / 搜索结果都复用它 */
export function IdeaStream({
  filter,
  emptyTitle = "这里还很安静。",
  emptyBody = "记录第一个想法，思想网络会慢慢生长。",
  header,
  dense = false,
  searchQuery,
  limit,
}: {
  filter?: IdeaFilter;
  emptyTitle?: string;
  emptyBody?: string;
  header?: React.ReactNode;
  dense?: boolean;
  searchQuery?: string;
  limit?: number;
}) {
  const ideas = useWorkspace((s) => s.ideas);
  const topics = useWorkspace((s) => s.topics);
  const projects = useWorkspace((s) => s.projects);
  const ready = useWorkspace((s) => s.ready);

  const topicName = (id: string) => topics.find((t) => t.id === id)?.name ?? "";
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";

  const list = useMemo(() => {
    let out = ideas;
    if (filter?.topicId) out = out.filter((i) => i.topicIds.includes(filter.topicId!));
    if (filter?.projectId) out = out.filter((i) => i.projectIds.includes(filter.projectId!));
    if (filter?.tag) out = out.filter((i) => i.tags.includes(filter.tag!));
    if (filter?.favorite) out = out.filter((i) => i.favorite);
    if (searchQuery?.trim()) {
      out = searchItems(out, searchQuery.trim()).map((r) => r.item);
    }
    return limit ? out.slice(0, limit) : out;
  }, [ideas, filter, searchQuery, limit]);

  return (
    <div>
      {header}
      {!ready ? (
        <IdeaSkeletonList count={4} />
      ) : list.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : (
        <div className={cn("flex flex-col", dense && "gap-0")}>
          <AnimatePresence initial={false}>
            {list.map((idea) => (
              <div key={idea.id}>
                <IdeaCard
                  idea={idea}
                  compact={dense}
                  topicNames={idea.topicIds.map(topicName).filter(Boolean)}
                  projectNames={idea.projectIds.map(projectName).filter(Boolean)}
                />
                <div className="mx-3 h-px bg-[var(--line)]" />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/** 带本地过滤框的想法列表（/ideas 用） */
export function IdeaBrowser() {
  const [query, setQuery] = useState("");
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const ideas = useWorkspace((s) => s.ideas);
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const i of ideas) for (const t of i.tags) set.add(t);
    return [...set].sort();
  }, [ideas]);
  const [tag, setTag] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-line bg-[var(--bg-card)] px-3 py-1.5">
          <Search size={14} strokeWidth={1.5} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="在所有灵感里找找…"
            aria-label="搜索灵感"
            className="w-full bg-transparent text-[13.5px] text-fg placeholder:text-faint focus:outline-none"
          />
        </div>
        <FilterChip active={onlyFavorite} onClick={() => setOnlyFavorite((v) => !v)}>
          收藏
        </FilterChip>
      </div>

      {tags.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <FilterChip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </FilterChip>
          ))}
        </div>
      ) : null}

      <IdeaStream
        searchQuery={query}
        filter={{ tag: tag ?? undefined, favorite: onlyFavorite || undefined }}
        emptyTitle="什么都没找到。"
        emptyBody="换个词试试，或者记下此刻这个念头。"
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[12px] quiet-hover",
        active
          ? "border-accent-line bg-[var(--accent-soft)] text-accent"
          : "border-line text-muted hover:text-fg",
      )}
    >
      {children}
    </motion.button>
  );
}

export type { Idea };
