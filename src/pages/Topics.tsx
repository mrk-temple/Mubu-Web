import { Link } from "react-router-dom";
import { useMemo } from "react";
import { PageShell } from "@/components/ideas";
import { TopBar } from "@/components/layout";
import { EmptyState, SectionLabel } from "@/components/ui";
import { useWorkspace } from "@/stores/useWorkspace";

export function TopicsPage() {
  const topics = useWorkspace((s) => s.topics);
  const ideas = useWorkspace((s) => s.ideas);
  const connections = useWorkspace((s) => s.connections);

  const roots = useMemo(() => topics.filter((t) => !t.parentId), [topics]);

  return (
    <>
      <TopBar title="主题" meta={`${topics.length} 个`} />
      <PageShell>
        <SectionLabel>Clusters</SectionLabel>
        <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
          主题不是文件夹。它是想法聚在一起之后，自己浮上来的名字。
        </p>

        {roots.length === 0 ? (
          <EmptyState title="还没有主题。" body="当几条想法开始重合，主题会自己出现。" />
        ) : (
          <ul className="mt-8 flex flex-col">
            {roots.map((t) => {
              const children = topics.filter((c) => c.parentId === t.id);
              const mine = ideas.filter((i) =>
                i.topicIds.some(
                  (id) => id === t.id || children.some((c) => c.id === id),
                ),
              );
              const linked = connections.filter(
                (c) =>
                  mine.some((i) => i.id === c.sourceId) &&
                  mine.some((i) => i.id === c.targetId),
              );
              return (
                <li key={t.id}>
                  <Link
                    to={`/topics/${t.id}`}
                    className="group flex items-start gap-4 border-t border-line px-2 py-5 quiet-hover"
                  >
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: t.color ?? "var(--fg-faint)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-medium text-fg">{t.name}</p>
                      {children.length > 0 ? (
                        <p className="mt-1 truncate text-[12.5px] text-faint">
                          {children.map((c) => c.name).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums text-faint">
                      {mine.length} ideas · {linked.length} connections
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PageShell>
    </>
  );
}
