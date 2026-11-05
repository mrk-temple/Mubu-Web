import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { IdeaStream, PageShell } from "@/components/ideas";
import { TopBar } from "@/components/layout";
import { OutlineEditor, ProjectCanvas } from "@/components/projects";
import { EmptyState, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { degreeMap } from "@/lib/selectors";
import { relativeTime } from "@/lib/time";
import { useWorkspace } from "@/stores/useWorkspace";

type Tab = "overview" | "ideas" | "canvas" | "outline";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "概览" },
  { id: "ideas", label: "想法" },
  { id: "canvas", label: "画布" },
  { id: "outline", label: "大纲" },
];

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const projects = useWorkspace((s) => s.projects);
  const ideas = useWorkspace((s) => s.ideas);
  const connections = useWorkspace((s) => s.connections);
  const updateProject = useWorkspace((s) => s.updateProject);
  const [tab, setTab] = useState<Tab>("overview");

  const project = projects.find((p) => p.id === projectId);

  const scopedIdeas = useMemo(
    () => ideas.filter((i) => i.projectIds.includes(projectId)),
    [ideas, projectId],
  );
  const scopedConnections = useMemo(() => {
    const ids = new Set(scopedIdeas.map((i) => i.id));
    return connections.filter((c) => ids.has(c.sourceId) && ids.has(c.targetId));
  }, [connections, scopedIdeas]);
  const degrees = useMemo(() => degreeMap(scopedConnections), [scopedConnections]);
  const outlineNodes = useWorkspace((s) => s.outlineNodes);
  const chapterCount = useMemo(
    () =>
      new Set(
        outlineNodes
          .filter((n) => n.projectId === projectId && n.kind === "chapter")
          .map((n) => n.id),
      ).size,
    [outlineNodes, projectId],
  );

  if (!project) {
    return (
      <>
        <TopBar title="项目" />
        <PageShell>
          <EmptyState title="这个项目不在了。" body="或者它还只是一个念头。" />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <TopBar
        leading={
          <div className="flex items-baseline gap-2.5">
            <h1 className="truncate text-[15px] font-medium text-fg">{project.name}</h1>
            <span className="shrink-0 text-[12px] text-faint">
              {scopedIdeas.length} 条想法 · {scopedConnections.length} 条连接
            </span>
          </div>
        }
      />

      <div className="mubu-project-tabs flex items-center gap-1 border-b border-line px-4 sm:px-8" aria-label="项目视图">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-2.5 py-2 text-[13px] quiet-hover",
              tab === t.id ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            {tab === t.id ? (
              <span className="absolute inset-x-2 -bottom-px h-px bg-accent" />
            ) : null}
          </button>
        ))}
      </div>

      {tab === "canvas" ? (
        <ProjectCanvas projectId={projectId} />
      ) : tab === "outline" ? (
        <div className="flex-1 overflow-y-auto">
          <OutlineEditor projectId={projectId} />
        </div>
      ) : tab === "ideas" ? (
        <PageShell>
          <IdeaStream
            filter={{ projectId }}
            emptyTitle="这个项目还很空。"
            emptyBody="把相关的想法收进来，它们会排出顺序。"
          />
        </PageShell>
      ) : (
        <PageShell>
          <SectionLabel>项目概览</SectionLabel>
          <h2 className="mubu-page-title">{project.name}</h2>
          <textarea
            value={project.description ?? ""}
            onChange={(e) => void updateProject(project.id, { description: e.target.value })}
            rows={3}
            placeholder="这个项目想做成什么？"
            className="mt-2 w-full resize-none bg-transparent text-[15px] leading-[1.8] text-fg placeholder:text-faint focus:outline-none"
          />
          <p className="mt-2 text-[11.5px] text-faint">
            自动保存 · 最近更新 {relativeTime(project.updatedAt)}
          </p>

          <div className="my-8 grid grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
            <Stat label="想法" value={scopedIdeas.length} />
            <Stat label="连接" value={scopedConnections.length} />
            <Stat label="章节" value={chapterCount} />
            <Stat
              label="连接最多的想法"
              value={
                scopedIdeas.length === 0
                  ? "—"
                  : (scopedIdeas.reduce((a, b) =>
                      (degrees.get(a.id) ?? 0) >= (degrees.get(b.id) ?? 0) ? a : b,
                    ).title ??
                    scopedIdeas[0].content.split("\n")[0].slice(0, 10))
              }
              small
            />
          </div>

          <SectionLabel>最相关的几条</SectionLabel>
          <ul className="mt-3 flex flex-col gap-3">
            {[...scopedIdeas]
              .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))
              .slice(0, 5)
              .map((i) => (
                <li key={i.id} className="text-[13.5px] leading-relaxed text-muted">
                  <span className="mr-2 tabular-nums text-faint">
                    {String((degrees.get(i.id) ?? 0)).padStart(2, "0")}
                  </span>
                  {i.title ?? i.content.split("\n")[0]}
                </li>
              ))}
          </ul>

          {scopedIdeas.length === 0 ? (
            <EmptyState
              title="每一个项目，都从一个念头开始。"
              body="先记录想法，再从想法详情的「项目」区域把它加入这里。"
            />
          ) : null}
        </PageShell>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.1em] text-faint">{label}</p>
      <p
        className={cn(
          "mt-1 tabular-nums text-fg",
          small ? "text-[14px] leading-snug" : "editorial text-[26px]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

