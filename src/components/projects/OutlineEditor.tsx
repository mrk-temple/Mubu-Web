import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, EmptyState, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { OutlineNode, OutlineNodeKind } from "@/types";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";

/**
 * Outline —— 从想法到作品的那一步。
 *
 * 零散想法 → 结构 → 文章 / 项目 / 一本书。
 * 拖拽排序、建章节、把 Idea 放进章节，就这三件事。
 */
export function OutlineEditor({ projectId }: { projectId: string }) {
  const allNodes = useWorkspace((s) => s.outlineNodes);
  const nodes = useMemo(
    () => allNodes.filter((n) => n.projectId === projectId),
    [allNodes, projectId],
  );
  const ideas = useWorkspace((s) => s.ideas);
  const projects = useWorkspace((s) => s.projects);
  const addOutlineNode = useWorkspace((s) => s.addOutlineNode);
  const updateOutlineNode = useWorkspace((s) => s.updateOutlineNode);
  const removeOutlineNode = useWorkspace((s) => s.removeOutlineNode);
  const reorderOutlineNode = useWorkspace((s) => s.reorderOutlineNode);
  const openIdea = useUI((s) => s.openIdea);
  const toast = useUI((s) => s.toast);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId);
  const chapters = useMemo(
    () => nodes.filter((n) => n.parentId === null).sort((a, b) => a.order - b.order),
    [nodes],
  );
  const childrenOf = (id: string) =>
    nodes.filter((n) => n.parentId === id).sort((a, b) => a.order - b.order);

  const usedIdeaIds = new Set(nodes.map((n) => n.ideaId).filter(Boolean));
  const availableIdeas = (project?.ideaIds ?? [])
    .map((id) => ideas.find((i) => i.id === id))
    .filter(Boolean)
    .filter((i) => !usedIdeaIds.has(i!.id));

  const addChapter = async () => {
    await addOutlineNode({
      projectId,
      parentId: null,
      kind: "chapter",
      title: `第 ${chapters.length + 1} 章 · 新章节`,
    });
    toast("章节已创建，点击标题即可重命名", "quiet");
  };

  const dropOn = async (target: OutlineNode) => {
    if (!dragId || dragId === target.id) return;
    const parentId = target.parentId;
    const siblings = nodes
      .filter((n) => n.parentId === parentId && n.id !== dragId)
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((n) => n.id === target.id);
    await reorderOutlineNode(dragId, Math.max(0, idx), parentId);
    setDragId(null);
  };

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-6 sm:px-8">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <SectionLabel>作品大纲</SectionLabel>
          <h2 className="mt-1.5 editorial text-[22px] text-fg">
            {project?.name ?? "未命名"}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {chapters.length} 个章节 ·{" "}
            {nodes.filter((n) => n.kind === "idea").length} 条想法在结构里
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void addChapter()}>
          <Plus size={13} strokeWidth={1.5} /> 新建章节
        </Button>
      </header>

      {chapters.length === 0 ? (
        <EmptyState
          title="从结构开始。"
          body="先建章节，再从本项目的想法中选入内容。"
          action={
            <Button variant="accent" onClick={() => void addChapter()}>
              创建第一章
            </Button>
          }
        />
      ) : (
        <ol className="flex flex-col gap-1">
          {chapters.map((chapter) => {
            const kids = childrenOf(chapter.id);
            const isCollapsed = collapsed.has(chapter.id);
            return (
              <li key={chapter.id}>
                <div
                  draggable
                  onDragStart={() => setDragId(chapter.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => void dropOn(chapter)}
                  className="group flex items-center gap-1 rounded-md px-1 py-1 quiet-hover"
                >
                  <GripVertical
                    size={13}
                    strokeWidth={1.5}
                    className="shrink-0 cursor-grab text-faint opacity-0 group-hover:opacity-100 active:cursor-grabbing"
                  />
                  <button
                    type="button"
                    aria-label={isCollapsed ? "展开" : "折叠"}
                    onClick={() =>
                      setCollapsed((s) => {
                        const next = new Set(s);
                        if (next.has(chapter.id)) next.delete(chapter.id);
                        else next.add(chapter.id);
                        return next;
                      })
                    }
                    className="rounded p-0.5 text-faint quiet-hover"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={13} strokeWidth={1.5} />
                    ) : (
                      <ChevronDown size={13} strokeWidth={1.5} />
                    )}
                  </button>
                  <input
                    value={chapter.title}
                    onChange={(e) =>
                      void updateOutlineNode(chapter.id, { title: e.target.value })
                    }
                    aria-label="章节标题"
                    className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-fg focus:outline-none"
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="在此章节添加想法"
                    onClick={() => setShowPicker(chapter.id)}
                  >
                    <Plus size={13} strokeWidth={1.5} />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="删除章节"
                    onClick={() => void removeOutlineNode(chapter.id)}
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </Button>
                </div>

                {showPicker === chapter.id ? (
                  <div className="ml-8 rounded-lg border border-line bg-[var(--bg-card)] p-2">
                    <p className="px-1 pb-1 text-[11px] text-faint">选择要放入本章节的想法</p>
                    <ul className="max-h-[220px] overflow-y-auto">
                      {availableIdeas.map((i) => (
                        <li key={i!.id}>
                          <button
                            type="button"
                            onClick={async () => {
                              await addOutlineNode({
                                projectId,
                                parentId: chapter.id,
                                kind: "idea",
                                title: i!.title ?? i!.content.split("\n")[0],
                                ideaId: i!.id,
                              });
                              setShowPicker(null);
                              toast("已放入章节", "quiet");
                            }}
                            className="w-full truncate rounded-md px-2 py-1 text-left text-[13px] text-muted quiet-hover hover:text-fg"
                          >
                            {i!.title ?? i!.content.split("\n")[0]}
                          </button>
                        </li>
                      ))}
                      {availableIdeas.length === 0 ? (
                        <li className="px-2 py-2 text-[12px] text-faint">
                          暂无可选想法。先在想法详情中将想法加入本项目。
                        </li>
                      ) : null}
                    </ul>
                    <div className="mt-1 border-t border-line pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPicker(null)}
                        className="rounded-md px-2 py-1 text-[12px] text-faint quiet-hover"
                      >
                        关闭
                      </button>
                    </div>
                  </div>
                ) : null}

                {!isCollapsed ? (
                  <ul className="ml-8 flex flex-col border-l border-line pl-2">
                    {kids.map((child) => (
                      <li key={child.id}>
                        <OutlineRow
                          node={child}
                          onDragStart={() => setDragId(child.id)}
                          onDrop={() => void dropOn(child)}
                          onOpen={() => child.ideaId && openIdea(child.ideaId)}
                          onRename={(t) => void updateOutlineNode(child.id, { title: t })}
                          onRemove={() => void removeOutlineNode(child.id)}
                        />
                      </li>
                    ))}
                    {kids.length === 0 ? (
                      <li className="px-2 py-1.5 text-[12.5px] text-faint">
                        <button type="button" onClick={() => setShowPicker(chapter.id)} className="rounded-md px-1 py-1 text-accent quiet-hover">
                          + 从本项目选择想法
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function OutlineRow({
  node,
  onDragStart,
  onDrop,
  onOpen,
  onRename,
  onRemove,
}: {
  node: OutlineNode;
  onDragStart: () => void;
  onDrop: () => void;
  onOpen: () => void;
  onRename: (t: string) => void;
  onRemove: () => void;
}) {
  const kindLabel: Record<OutlineNodeKind, string> = {
    chapter: "章节",
    section: "小节",
    idea: "想法",
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="group flex items-center gap-2 rounded-md px-1.5 py-1 quiet-hover"
    >
      <GripVertical
        size={12}
        strokeWidth={1.5}
        className="shrink-0 cursor-grab text-faint opacity-0 group-hover:opacity-100 active:cursor-grabbing"
      />
      <span className="w-8 shrink-0 text-[10.5px] uppercase tracking-[0.06em] text-faint">
        {kindLabel[node.kind]}
      </span>
      {node.kind === "idea" ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex-1 truncate text-left text-[13.5px] text-muted",
            "quiet-hover hover:text-fg hover:underline",
          )}
        >
          {node.title}
        </button>
      ) : (
        <input
          value={node.title}
          onChange={(e) => onRename(e.target.value)}
          className="flex-1 bg-transparent text-[13.5px] text-muted focus:outline-none"
        />
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="移出大纲"
        onClick={onRemove}
        className="opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 size={11} strokeWidth={1.5} />
      </Button>
    </div>
  );
}
