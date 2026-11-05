import {
  Download,
  Frame,
  Link2,
  Plus,
  Square,
  Type as TypeIcon,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Tooltip } from "@/components/ui";
import { createId } from "@/lib/id";
import { cn } from "@/lib/cn";
import type { CanvasItem, CanvasItemKind, Idea } from "@/types";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";

const BOARD = { w: 2200, h: 1400 };
const COLORS = ["#556B5D", "#6E7F8C", "#8C7B6B", "#7D6B7F"];

/**
 * Project Canvas —— 项目级别的小黑板。
 * 支持拖拽、连接、分组框、文本、想法卡片，
 * 但刻意不做成 Figma：只有这五样。
 */
export function ProjectCanvas({ projectId }: { projectId: string }) {
  const allItems = useWorkspace((s) => s.canvasItems);
  const allEdges = useWorkspace((s) => s.canvasEdges);
  const items = useMemo(
    () => allItems.filter((i) => i.projectId === projectId),
    [allItems, projectId],
  );
  const edges = useMemo(
    () => allEdges.filter((e) => e.projectId === projectId),
    [allEdges, projectId],
  );
  const ideas = useWorkspace((s) => s.ideas);
  const projects = useWorkspace((s) => s.projects);
  const saveCanvasItem = useWorkspace((s) => s.saveCanvasItem);
  const updateCanvasItem = useWorkspace((s) => s.updateCanvasItem);
  const removeCanvasItem = useWorkspace((s) => s.removeCanvasItem);
  const saveCanvasEdge = useWorkspace((s) => s.saveCanvasEdge);
  const removeCanvasEdge = useWorkspace((s) => s.removeCanvasEdge);
  const createCanvasIdeaItem = useWorkspace((s) => s.createCanvasIdeaItem);
  const openIdea = useUI((s) => s.openIdea);
  const toast = useUI((s) => s.toast);

  const project = projects.find((p) => p.id === projectId);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [addingIdea, setAddingIdea] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const ideaOf = (id?: string) => ideas.find((i) => i.id === id);

  const sorted = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);

  const startDrag = useCallback(
    (e: React.PointerEvent, item: CanvasItem) => {
      if (item.kind === "frame") return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        id: item.id,
        ox: e.clientX / zoom - item.x,
        oy: e.clientY / zoom - item.y,
      };
    },
    [zoom],
  );

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const x = Math.round(e.clientX / zoom - d.ox);
      const y = Math.round(e.clientY / zoom - d.oy);
      void updateCanvasItem(d.id, { x, y });
    },
    [updateCanvasItem, zoom],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const addItem = async (kind: CanvasItemKind) => {
    const base: CanvasItem = {
      id: createId("citem"),
      projectId,
      kind,
      x: 120 + (items.length % 5) * 240,
      y: 100 + Math.floor(items.length / 5) * 200,
      w: kind === "frame" ? 640 : kind === "group" ? 360 : 210,
      h: kind === "frame" ? 320 : kind === "group" ? 220 : 110,
      text: kind === "text" ? "新的想法片段" : "",
      label: kind === "frame" ? "Frame" : kind === "group" ? "Group" : undefined,
      color: kind === "frame" ? COLORS[items.length % COLORS.length] : undefined,
      order: items.length,
    };
    await saveCanvasItem(base);
    toast("已添加", "quiet");
  };

  const edgePath = (from: CanvasItem, to: CanvasItem) => {
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  const candidates = project?.ideaIds.map(ideaOf).filter(Boolean) ?? [];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-4 py-2">
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <Plus size={13} strokeWidth={1.5} /> 添加
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuItem onSelect={() => void addItem("text")}>文本</MenuItem>
            <MenuItem onSelect={() => void addItem("group")}>分组</MenuItem>
            <MenuItem onSelect={() => void addItem("frame")}>Frame</MenuItem>
            <MenuItem onSelect={() => setAddingIdea(true)}>想法卡片…</MenuItem>
          </MenuContent>
        </Menu>

        <div className="mx-2 h-4 w-px bg-[var(--line)]" />

        <Tooltip label="缩小">
          <Button size="icon-sm" variant="ghost" aria-label="缩小" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>
            <ZoomOut size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <span className="w-10 text-center text-[11.5px] tabular-nums text-faint">
          {Math.round(zoom * 100)}%
        </span>
        <Tooltip label="放大">
          <Button size="icon-sm" variant="ghost" aria-label="放大" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
            <ZoomIn size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <Button size="sm" variant="ghost" onClick={() => setPan({ x: 40, y: 30 })}>
          <Download size={13} strokeWidth={1.5} className="rotate-180" /> 归位
        </Button>

        <span className="ml-auto text-[11.5px] text-faint">
          {linkFrom ? "点击另一个卡片完成连接" : "拖动移动 · 用 ⛓ 把卡片连起来"}
        </span>
      </div>

      <div ref={boardRef} className="dot-field relative min-h-0 flex-1 overflow-auto bg-[var(--bg)]">
        <div
          className="relative origin-top-left"
          style={{ width: BOARD.w, height: BOARD.h, transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {edges.map((e) => {
              const from = items.find((i) => i.id === e.sourceItemId);
              const to = items.find((i) => i.id === e.targetItemId);
              if (!from || !to) return null;
              const midX = (from.x + from.w + to.x) / 2;
              const midY = (from.y + from.h / 2 + to.y + to.h / 2) / 2;
              return (
                <g key={e.id} className="pointer-events-auto">
                  <path
                    d={edgePath(from, to)}
                    fill="none"
                    stroke="var(--edge)"
                    strokeWidth={1}
                  />
                  <path
                    d={edgePath(from, to)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    onClick={() => void removeCanvasEdge(e.id)}
                    className="cursor-pointer"
                  />
                  {e.label ? (
                    <text
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      fill="var(--fg-faint)"
                      fontSize={10}
                      fontFamily="inherit"
                    >
                      {e.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {sorted.map((item) => (
            <CanvasNode
              key={item.id}
              item={item}
              idea={ideaOf(item.ideaId)}
              linking={linkFrom}
              onStartDrag={startDrag}
              onToggleLink={(id) => {
                if (!linkFrom) {
                  setLinkFrom(id);
                  return;
                }
                if (linkFrom === id) return setLinkFrom(null);
                void saveCanvasEdge({
                  projectId,
                  sourceItemId: linkFrom,
                  targetItemId: id,
                });
                setLinkFrom(null);
                toast("Connection created");
              }}
              onOpenIdea={(id) => openIdea(id)}
              onPatch={(patch) => void updateCanvasItem(item.id, patch)}
              onRemove={() => {
                void removeCanvasItem(item.id);
                toast("已删除", "quiet");
              }}
            />
          ))}
        </div>

        {sorted.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState
              title="每一个项目，都从一个念头开始。"
              body="把想法拖进来，让它们排出自己的顺序。"
              className="border-none"
              action={
                <Button variant="accent" onClick={() => setAddingIdea(true)}>
                  放入第一个想法
                </Button>
              }
            />
          </div>
        ) : null}
      </div>

      {addingIdea ? (
        <div className="fixed inset-0 z-[88] flex items-center justify-center bg-scrim/40 px-6">
          <div className="w-full max-w-[380px] rounded-lg border border-line bg-[var(--bg-card)] p-4 shadow-lift">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-fg">放入想法</p>
              <Button size="icon-sm" variant="ghost" aria-label="关闭" onClick={() => setAddingIdea(false)}>
                <X size={13} strokeWidth={1.5} />
              </Button>
            </div>
            <ul className="mt-2 max-h-[46vh] overflow-y-auto">
              {candidates.map((c) => (
                <li key={c!.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      await createCanvasIdeaItem(
                        projectId,
                        c!.id,
                        120 + (items.length % 5) * 240,
                        100 + Math.floor(items.length / 5) * 200,
                      );
                      setAddingIdea(false);
                      toast("已放入", "quiet");
                    }}
                    className="w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] text-muted quiet-hover hover:text-fg"
                  >
                    {c!.title ?? c!.content.split("\n")[0]}
                  </button>
                </li>
              ))}
              {candidates.length === 0 ? (
                <li className="px-2 py-3 text-[12.5px] text-faint">
                  先把这个想法加入项目，才能放到画布上。
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CanvasNode({
  item,
  idea,
  linking,
  onStartDrag,
  onToggleLink,
  onOpenIdea,
  onPatch,
  onRemove,
}: {
  item: CanvasItem;
  idea?: Idea;
  linking: string | null;
  onStartDrag: (e: React.PointerEvent, item: CanvasItem) => void;
  onToggleLink: (id: string) => void;
  onOpenIdea: (id: string) => void;
  onPatch: (patch: Partial<CanvasItem>) => void;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  const isFrame = item.kind === "frame";
  const isGroup = item.kind === "group";

  return (
    <div
      onPointerDown={(e) => !isFrame && onStartDrag(e, item)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "group absolute select-none",
        !isFrame && "cursor-grab active:cursor-grabbing",
        linking === item.id && "ring-2 ring-[var(--accent-line)]",
      )}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h, zIndex: isFrame ? 0 : 1 }}
    >
      {isFrame ? (
        <div
          className="h-full w-full rounded-[10px] border border-dashed"
          style={{ borderColor: item.color ?? "var(--line-strong)" }}
        >
          {item.label ? (
            <span className="ml-2 mt-1 inline-block text-[11px] tracking-[0.06em] text-faint">
              {item.label}
            </span>
          ) : null}
        </div>
      ) : isGroup ? (
        <div className="h-full w-full rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg-hover)] px-3 py-2">
          <input
            value={item.label ?? ""}
            onChange={(e) => onPatch({ label: e.target.value })}
            className="w-full bg-transparent text-[11px] uppercase tracking-[0.08em] text-faint focus:outline-none"
          />
          <textarea
            value={item.text ?? ""}
            onChange={(e) => onPatch({ text: e.target.value })}
            className="mt-1 h-[calc(100%-24px)] w-full resize-none bg-transparent text-[13px] leading-relaxed text-muted focus:outline-none"
          />
        </div>
      ) : item.kind === "text" ? (
        <div className="h-full w-full rounded-lg border border-line bg-[var(--bg-card)] px-3 py-2 shadow-soft">
          <TypeIcon size={11} strokeWidth={1.5} className="mb-1 text-faint" />
          <textarea
            value={item.text ?? ""}
            onChange={(e) => onPatch({ text: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-[calc(100%-18px)] w-full resize-none bg-transparent text-[13px] leading-relaxed text-fg focus:outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => idea && onOpenIdea(idea.id)}
          className="h-full w-full rounded-lg border border-line bg-[var(--bg-card)] px-3.5 py-3 text-left shadow-soft"
        >
          <p className="line-clamp-3 text-[13px] leading-[1.5] text-fg">
            {idea?.title ?? idea?.content.split("\n")[0] ?? "（已删除的想法）"}
          </p>
          <span className="mt-2 block text-[10.5px] text-faint">
            {idea?.tags.slice(0, 2).map((t) => `#${t}`).join(" ") || "Idea"}
          </span>
        </button>
      )}

      <div
        className={cn(
          "absolute -top-2.5 right-1 flex items-center gap-0.5 rounded-md border border-line bg-[var(--bg-card)] p-0.5 shadow-soft transition-opacity",
          hover ? "opacity-100" : "opacity-0",
        )}
      >
        {!isFrame ? (
          <button
            type="button"
            aria-label="连接"
            onClick={() => onToggleLink(item.id)}
            className="rounded p-1 text-faint quiet-hover hover:text-fg"
          >
            <Link2 size={12} strokeWidth={1.5} />
          </button>
        ) : (
          <span className="px-1 text-faint">
            <Frame size={12} strokeWidth={1.5} />
          </span>
        )}
        {!isFrame && item.kind !== "idea" ? (
          <span className="px-1 text-faint">
            <Square size={12} strokeWidth={1.5} />
          </span>
        ) : null}
        <button
          type="button"
          aria-label="删除"
          onClick={onRemove}
          className="rounded p-1 text-faint quiet-hover hover:text-[#a15c53]"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
