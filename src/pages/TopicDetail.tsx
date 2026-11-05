import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GraphCanvas } from "@/components/graph";
import { IdeaStream, PageShell } from "@/components/ideas";
import { TopBar } from "@/components/layout";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { monthLabel, shortDate, timeOfDay } from "@/lib/time";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
import type { Idea } from "@/types";

type View = "stream" | "graph" | "timeline";

const TABS: Array<{ id: View; label: string }> = [
  { id: "stream", label: "Stream" },
  { id: "graph", label: "Graph" },
  { id: "timeline", label: "Timeline" },
];

export function TopicPage() {
  const { topicId = "" } = useParams();
  const topics = useWorkspace((s) => s.topics);
  const ideas = useWorkspace((s) => s.ideas);
  const connections = useWorkspace((s) => s.connections);
  const [view, setView] = useState<View>("stream");

  const topic = topics.find((t) => t.id === topicId);
  const children = useMemo(
    () => topics.filter((t) => t.parentId === topicId),
    [topics, topicId],
  );
  const scope = useMemo(
    () => [topicId, ...children.map((c) => c.id)],
    [topicId, children],
  );
  const scopedIdeas = useMemo(
    () => ideas.filter((i) => i.topicIds.some((t) => scope.includes(t))),
    [ideas, scope],
  );
  const scopedConnections = useMemo(() => {
    const ids = new Set(scopedIdeas.map((i) => i.id));
    return connections.filter((c) => ids.has(c.sourceId) && ids.has(c.targetId));
  }, [connections, scopedIdeas]);

  if (!topic) {
    return (
      <>
        <TopBar title="主题" />
        <PageShell>
          <EmptyState title="这个主题不存在。" body="也许它被合并进别的名字里了。" />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <TopBar
        leading={
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-[15px] font-medium text-fg">{topic.name}</h1>
            <span className="text-[12px] text-faint">
              {scopedIdeas.length} ideas · {scopedConnections.length} connections
            </span>
          </div>
        }
      />

      <div className="flex items-center gap-1 border-b border-line px-4 sm:px-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={cn(
              "relative px-2.5 py-2 text-[13px] quiet-hover",
              view === t.id ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            {view === t.id ? (
              <span className="absolute inset-x-2 -bottom-px h-px bg-accent" />
            ) : null}
          </button>
        ))}
        {children.length > 0 ? (
          <div className="ml-4 flex items-center gap-2 overflow-x-auto">
            {children.map((c) => (
              <Link
                key={c.id}
                to={`/topics/${c.id}`}
                className="whitespace-nowrap rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-muted quiet-hover hover:text-fg"
              >
                {c.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {view === "graph" ? (
        <GraphCanvas topicId={topicId} />
      ) : (
        <PageShell>
          {view === "stream" ? (
            <IdeaStream
              filter={{ topicId }}
              emptyTitle="这个主题还很安静。"
              emptyBody="再记几条，它们会自己聚过来。"
            />
          ) : (
            <TopicTimeline ideas={scopedIdeas} />
          )}
        </PageShell>
      )}
    </>
  );
}

export function TopicTimeline({ ideas }: { ideas: Idea[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof ideas>();
    for (const i of ideas) {
      const key = new Date(i.createdAt).toDateString();
      const arr = map.get(key);
      if (arr) arr.push(i);
      else map.set(key, [i]);
    }
    return [...map.entries()];
  }, [ideas]);

  if (groups.length === 0) {
    return <EmptyState title="还没有时间线。" body="从今天的第一条开始。" />;
  }

  return (
    <ol className="flex flex-col">
      {groups.map(([key, list]) => {
        const d = new Date(list[0].createdAt);
        return (
          <li key={key} className="border-t border-line py-5">
            <div className="flex items-baseline gap-3">
              <span className="editorial w-8 text-[22px] tabular-nums text-fg">
                {d.getDate()}
              </span>
              <div>
                <p className="text-[13px] text-muted">{monthLabel(list[0].createdAt)}</p>
                <p className="text-[11.5px] text-faint">
                  {shortDate(list[0].createdAt)} · {timeOfDay(list[0].createdAt)}
                </p>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-2 pl-11">
              {list.map((i) => (
                <li key={i.id}>
                  <TopicTimelineRow ideaId={i.id} label={i.title ?? i.content.split("\n")[0]} />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function TopicTimelineRow({ ideaId, label }: { ideaId: string; label: string }) {
  const openIdea = useUI((s) => s.openIdea);
  return (
    <button
      type="button"
      onClick={() => openIdea(ideaId)}
      className="text-left text-[13.5px] leading-relaxed text-muted quiet-hover hover:text-fg"
    >
      {label}
    </button>
  );
}
