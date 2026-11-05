import { useMemo } from "react";
import { IdeaStream, PageShell } from "@/components/ideas";
import { TopBar } from "@/components/layout";
import { EmptyState, SectionLabel } from "@/components/ui";
import { monthLabel, timeOfDay } from "@/lib/time";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
import type { Idea } from "@/types";

/**
 * Timeline —— 回看自己过去思考的入口。
 * 按 月 / 日 分组，不做统计图表。
 */
export function TimelinePage() {
  const ideas = useWorkspace((s) => s.ideas);
  const openIdea = useUI((s) => s.openIdea);

  const months = useMemo(() => {
    const byMonth = new Map<string, Map<string, Idea[]>>();
    for (const idea of ideas) {
      const d = new Date(idea.createdAt);
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      const dKey = d.toDateString();
      const month = byMonth.get(mKey) ?? new Map<string, Idea[]>();
      const day = month.get(dKey) ?? [];
      day.push(idea);
      month.set(dKey, day);
      byMonth.set(mKey, month);
    }
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [ideas]);

  return (
    <>
      <TopBar title="时间线" meta={`${ideas.length} 条想法`} />
      <PageShell>
        <SectionLabel>Timeline</SectionLabel>
        <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
          翻回去看，会发现自己一直在同一件事上打转 —— 那就是值得写下去的东西。
        </p>

        {months.length === 0 ? (
          <EmptyState title="还没有过去。" body="从今天开始记录，时间线会慢慢变厚。" />
        ) : (
          <div className="mt-8">
            {months.map(([mKey, days]) => {
              const first = [...days.values()][0][0];
              const entries = [...days.entries()];
              return (
                <section key={mKey} className="mb-10">
                  <h2 className="editorial border-b border-line pb-3 text-[20px] text-fg">
                    {monthLabel(first.createdAt)}
                  </h2>
                  <ol className="mt-1">
                    {entries.map(([dKey, list]) => {
                      const d = new Date(list[0].createdAt);
                      return (
                        <li
                          key={dKey}
                          className="flex gap-5 border-b border-line py-5 last:border-none"
                        >
                          <div className="w-10 shrink-0">
                            <p className="editorial text-[24px] leading-none tabular-nums text-fg">
                              {d.getDate()}
                            </p>
                            <p className="mt-1 text-[11px] tabular-nums text-faint">
                              {["日", "一", "二", "三", "四", "五", "六"][d.getDay()]}
                            </p>
                          </div>
                          <ol className="min-w-0 flex-1">
                            {list.map((idea) => (
                              <li key={idea.id}>
                                <button
                                  type="button"
                                  onClick={() => openIdea(idea.id)}
                                  className="group flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left quiet-hover"
                                >
                                  <span className="shrink-0 text-[11px] tabular-nums text-faint">
                                    {timeOfDay(idea.createdAt)}
                                  </span>
                                  <span className="flex-1 truncate text-[14px] leading-relaxed text-muted group-hover:text-fg">
                                    {idea.title ?? idea.content.split("\n")[0]}
                                  </span>
                                  {idea.tags[0] ? (
                                    <span className="shrink-0 text-[11px] text-faint">
                                      #{idea.tags[0]}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ol>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-4 border-t border-line pt-8">
          <SectionLabel>最近</SectionLabel>
          <div className="mt-3">
            <IdeaStream limit={5} dense />
          </div>
        </div>
      </PageShell>
    </>
  );
}
