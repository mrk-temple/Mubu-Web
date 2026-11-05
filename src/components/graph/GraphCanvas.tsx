import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection as RFConnection,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type NodeTypes,
  type Viewport,
  type OnNodeDrag,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PaperNode } from "./PaperNode";
import { BlockLabel, type BlockLabelData } from "./BlockLabel";
import { RelationPicker, type PendingLink } from "./RelationPicker";
import { FocusPanel } from "./FocusPanel";
import { EdgeNoteEditor } from "./EdgeNoteEditor";
import { EmptyState, Button, Tooltip } from "@/components/ui";
import { clusterKeyFor, degreeMap, hopNeighborhood } from "@/lib/selectors";
import { nodeSizeFor } from "@/lib/layout";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
import { useMediaQuery } from "@/hooks";
import { cn } from "@/lib/cn";
import type { ConnectionType } from "@/types";

const nodeTypes: NodeTypes = { paper: PaperNode, blockLabel: BlockLabel };

// 对象字面量每次渲染都是新引用，会让 React Flow 反复 fitView —— 提成常量
const FIT_VIEW_OPTIONS = { padding: 0.12, maxZoom: 0.95, minZoom: 0.35 } as const;
/** 关系标签只在放大后出现 —— 缩小到全景时它们只是噪点 */
// 0.75 的全图视图下标签只有 7.5px，是噪点；放到 0.85 以上才出现
const LABEL_ZOOM = 0.85;
const ALL = "__all__";
const PRO_OPTIONS = { hideAttribution: true } as const;
const EMPTY_HOPS = {
  focus: new Set<string>(),
  hop1: new Set<string>(),
  hop2: new Set<string>(),
};
const CONNECTION_LABELS: Record<ConnectionType, string> = {
  related: "相关",
  inspired: "启发",
  supports: "支持",
  conflicts: "冲突",
  extends: "延伸",
  source: "来源",
};

function labelOf(title: string | undefined, content: string): string {
  return (title ?? content.split("\n")[0]).slice(0, 18);
}

export function GraphCanvas({ topicId }: { topicId?: string }) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner topicId={topicId} />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner({ topicId }: { topicId?: string }) {
  const ideas = useWorkspace((s) => s.ideas);
  const connections = useWorkspace((s) => s.connections);
  const topics = useWorkspace((s) => s.topics);
  const positions = useWorkspace((s) => s.graphPositions);
  const setGraphPosition = useWorkspace((s) => s.setGraphPosition);
  const createConnection = useWorkspace((s) => s.createConnection);
  const updateConnection = useWorkspace((s) => s.updateConnection);
  const deleteConnection = useWorkspace((s) => s.deleteConnection);
  const resetGraphLayout = useWorkspace((s) => s.resetGraphLayout);
  const ready = useWorkspace((s) => s.ready);

  const focusIdeaId = useUI((s) => s.focusIdeaId);
  const setFocusIdea = useUI((s) => s.setFocusIdea);
  const openCapture = useUI((s) => s.openQuickCapture);
  const toast = useUI((s) => s.toast);

  const isCompact = useMediaQuery("(max-width: 1024px)");
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [editingEdge, setEditingEdge] = useState<{ id: string; x: number; y: number } | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [view, setView] = useState<string>(ALL);
  const [fitNonce, setFitNonce] = useState(0);

  const syncLabels = useCallback((zoom: number) => {
    const show = zoom >= LABEL_ZOOM;
    setShowLabels((prev) => (prev === show ? prev : show));
  }, []);
  const onMove = useCallback((_e: unknown, viewport: Viewport) => syncLabels(viewport.zoom), [syncLabels]);
  const onMoveEnd = useCallback((_e: unknown, viewport: Viewport) => syncLabels(viewport.zoom), [syncLabels]);

  const scopedIdeas = useMemo(() => {
    if (!topicId) return ideas;
    const ids = new Set(
      topics.filter((t) => t.id === topicId || t.parentId === topicId).map((t) => t.id),
    );
    return ideas.filter((i) => i.topicIds.some((t) => ids.has(t)));
  }, [ideas, topics, topicId]);

  const scopedConnections = useMemo(() => {
    const ids = new Set(scopedIdeas.map((i) => i.id));
    return connections.filter((c) => ids.has(c.sourceId) && ids.has(c.targetId));
  }, [connections, scopedIdeas]);

  const hops = useMemo(
    () => (focusIdeaId ? hopNeighborhood(focusIdeaId, scopedConnections, 2) : EMPTY_HOPS),
    [focusIdeaId, scopedConnections],
  );

  const degrees = useMemo(() => degreeMap(scopedConnections), [scopedConnections]);

  /**
   * 节点 / 连线在此纯函数派生，再一次同步给 React Flow。
   * 不在 effect 里「构建」图 —— 那会与 setState 互相触发，把渲染跑死。
   */
  /** 主题块：分块导航 + 放大到某一块 */
  const topicBlocks = useMemo(() => {
    const map = new Map<string, { label: string; color?: string; ids: string[] }>();
    for (const idea of scopedIdeas) {
      const key = clusterKeyFor(idea, topics);
      const topic = topics.find((t) => t.id === key);
      const bucket = map.get(key) ?? {
        label: key === "__none__" ? "未归类" : (topic?.name ?? ""),
        color: topic?.color,
        ids: [],
      };
      bucket.ids.push(idea.id);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => b[1].ids.length - a[1].ids.length);
  }, [scopedIdeas, topics]);

  const blocksRef = useRef<typeof topicBlocks>([]);
  blocksRef.current = topicBlocks;

  /** 「大一点才看得清关系」：默认不是铺满全图，而是放大到一块主题 */
  useEffect(() => {
    if (!ready || scopedIdeas.length === 0) return;
    const t = window.setTimeout(() => {
      if (view === ALL) {
        fitView({ ...FIT_VIEW_OPTIONS, duration: 320 });
        return;
      }
      const block = blocksRef.current.find(([k]) => k === view);
      if (!block) return;
      fitView({
        nodes: block[1].ids.map((id) => ({ id })),
        padding: 0.2,
        duration: 320,
        maxZoom: 1.05,
        minZoom: 0.4,
      });
    }, 90);
    return () => window.clearTimeout(t);
  }, [view, fitNonce, ready, scopedIdeas.length, fitView]);

  // 首次进入：放大到最大的一块
  useEffect(() => {
    if (!ready || topicBlocks.length === 0) return;
    setView((v) => (v === ALL ? (topicBlocks[0][0] ?? ALL) : v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const built = useMemo(() => {
    const topicById = new Map(topics.map((t) => [t.id, t]));

    const nextNodes: Node[] = scopedIdeas.map((idea) => {
      const topic = topicById.get(idea.topicIds[0] ?? "");
      const size = nodeSizeFor(idea);
      const hop: 0 | 1 | 2 = hops.hop1.has(idea.id) ? 1 : hops.hop2.has(idea.id) ? 2 : 0;
      const dim = focusIdeaId ? !hops.focus.has(idea.id) : false;

      return {
        id: idea.id,
        type: "paper",
        position: positions[idea.id] ?? { x: 0, y: 0 },
        width: size.width,
        draggable: !dim,
        className: dim ? "mubu-node-dim" : undefined,
        style: { opacity: dim ? 0.12 : 1, transition: "opacity 200ms ease" },
        data: {
          idea,
          topicName: topic?.name ?? "",
          topicColor: topic?.color,
          degree: degrees.get(idea.id) ?? 0,
          dim,
          hop,
          focused: idea.id === focusIdeaId,
        },
      };
    });

    const nextEdges: Edge[] = scopedConnections.map((c) => {
      const dim = focusIdeaId && !(hops.focus.has(c.sourceId) && hops.focus.has(c.targetId));
      return {
        id: c.id,
        source: c.sourceId,
        target: c.targetId,
        label: showLabels && c.type ? CONNECTION_LABELS[c.type] : undefined,
        style: { opacity: dim ? 0.08 : 1, stroke: "var(--edge)", strokeWidth: 1 },
        labelStyle: { fill: "var(--fg-faint)", fontSize: 10 },
        labelBgStyle: { fill: "var(--bg)" },
        labelBgPadding: [4, 2] as [number, number],
      };
    });

    // 极淡的主题名：只是一行字浮在块上方，不画框（画框就把网变成流程图了）
    const boxes = new Map<string, { x0: number; y0: number; n: number }>();
    for (const idea of scopedIdeas) {
      const key = clusterKeyFor(idea, topics);
      const p = positions[idea.id] ?? { x: 0, y: 0 };
      const b = boxes.get(key) ?? { x0: p.x, y0: p.y, n: 0 };
      b.x0 = Math.min(b.x0, p.x);
      b.y0 = Math.min(b.y0, p.y);
      b.n += 1;
      boxes.set(key, b);
    }
    const labelNodes: Node[] = [...boxes.entries()].map(([key, b]) => {
      const block = topicBlocks.find(([k]) => k === key)?.[1];
      return {
        id: `block:${key}`,
        type: "blockLabel",
        position: { x: b.x0 + 2, y: b.y0 - 30 },
        data: { label: block?.label ?? "", count: b.n, color: block?.color } as BlockLabelData,
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
        zIndex: -1,
      };
    });

    return { nextNodes: [...labelNodes, ...nextNodes], nextEdges };
  }, [scopedIdeas, scopedConnections, topics, positions, hops, focusIdeaId, degrees, topicBlocks, showLabels]);

  useEffect(() => {
    if (!ready) return;
    setNodes(built.nextNodes);
    setEdges(built.nextEdges);
  }, [ready, built, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: RFConnection) => {
      const source = ideas.find((i) => i.id === params.source);
      const target = ideas.find((i) => i.id === params.target);
      if (!source || !target || !params.source || !params.target) return;
      const rect = document.querySelector(".graph-pane")?.getBoundingClientRect();
      setPending({
        sourceId: params.source,
        targetId: params.target,
        x: (rect ? rect.left + rect.width / 2 : 400) - 150,
        y: rect ? rect.top + 120 : 200,
        sourceLabel: labelOf(source.title, source.content),
        targetLabel: labelOf(target.title, target.content),
      });
    },
    [ideas],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => setFocusIdea(focusIdeaId === node.id ? null : node.id),
    [focusIdeaId, setFocusIdea],
  );

  /**
   * 双击 = 「只看这一系列的关系」
   * 整张图 20 多个节点必然要缩到 0.5 上下；但一个系列往往只有几个节点，
   * 放大到它自己的邻域就能以正常字号读完这一串关系。
   */
  const focusNeighborhood = useCallback(
    (ideaId: string) => {
      const { focus } = hopNeighborhood(ideaId, scopedConnections, 2);
      setFocusIdea(ideaId);
      fitView({
        nodes: [...focus].map((id) => ({ id })),
        padding: 0.22,
        duration: 320,
        maxZoom: 1.05,
        minZoom: 0.4,
      });
    },
    [scopedConnections, setFocusIdea, fitView],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => focusNeighborhood(node.id),
    [focusNeighborhood],
  );

  const onEdgeClick: EdgeMouseHandler = useCallback((e, edge) => {
    setEditingEdge({ id: edge.id, x: e.clientX, y: e.clientY });
  }, []);

  const onPaneClick = useCallback(() => {
    setPending(null);
    setEditingEdge(null);
    setFocusIdea(null);
  }, [setFocusIdea]);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_, node) => void setGraphPosition(node.id, node.position),
    [setGraphPosition],
  );

  const editingConnection = editingEdge
    ? connections.find((c) => c.id === editingEdge.id) ?? null
    : null;

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className={cn("graph-pane relative min-w-0 flex-1 dot-field", isCompact && "h-[62vh]")}>
        {ready && scopedIdeas.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <EmptyState
              title="这里还很安静。"
              body="记录第一个想法，思想网络会慢慢生长。"
              className="border-none"
              action={
                <Button variant="accent" onClick={() => openCapture()}>
                  记录想法
                </Button>
              }
            />
          </div>
        ) : null}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMove={onMove}
          onMoveEnd={onMoveEnd}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          proOptions={PRO_OPTIONS}
          minZoom={0.15}
          maxZoom={1.6}
          nodesConnectable
          nodesDraggable
          elevateNodesOnSelect={false}
          panOnScroll
          className="bg-transparent"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--dot)" />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>

        {/* 主题分块导航：点一块就放大到它 */}
        <div className="pointer-events-none absolute left-4 top-3 z-10 flex max-w-[calc(100%-8rem)] flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setView(ALL)}
            className={cn(
              "pointer-events-auto rounded-full border px-2.5 py-0.5 text-[11.5px] shadow-soft transition-colors duration-150",
              view === ALL
                ? "border-accent-line bg-[var(--accent-soft)] text-accent"
                : "border-line bg-[var(--bg-card)] text-muted hover:text-fg",
            )}
          >
            全部 · {scopedIdeas.length}
          </button>
          {topicBlocks.map(([key, b]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "pointer-events-auto flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] shadow-soft transition-colors duration-150",
                view === key
                  ? "border-accent-line bg-[var(--accent-soft)] text-accent"
                  : "border-line bg-[var(--bg-card)] text-muted hover:text-fg",
              )}
            >
              <span
                className="h-[3px] w-[3px] rounded-full"
                style={{ background: b.color ?? "var(--fg-faint)" }}
              />
              {b.label}
              <span className="tabular-nums text-faint">{b.ids.length}</span>
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-2">
          {focusIdeaId ? (
            <button
              type="button"
              onClick={() => setFocusIdea(null)}
              className="pointer-events-auto rounded-full border border-line bg-[var(--bg-card)] px-3 py-1 text-[12px] text-muted shadow-soft quiet-hover hover:text-fg"
            >
              退出专注
            </button>
          ) : null}
          <Tooltip label="重新排布" side="bottom">
            <Button
              size="sm"
              variant="outline"
              className="pointer-events-auto bg-[var(--bg-card)]"
              onClick={() => {
                const pane = document.querySelector(".graph-pane")?.getBoundingClientRect();
                void resetGraphLayout(
                  pane ? { width: pane.width, height: pane.height } : undefined,
                ).then(() => setFitNonce((n) => n + 1));
                toast("已重新排布", "quiet");
              }}
            >
              重排
            </Button>
          </Tooltip>
        </div>

        <p className="pointer-events-none absolute bottom-4 right-4 z-10 hidden text-[11px] text-faint sm:block">
          拖动小圆点建立连接 · 点击专注 · 双击放大这一系列 · 点击连线写下当时的想法
        </p>
      </div>

      {focusIdeaId ? (
        <FocusPanel ideaId={focusIdeaId} onClose={() => setFocusIdea(null)} compact={isCompact} />
      ) : null}

      {pending ? (
        <RelationPicker
          pending={pending}
          onCancel={() => setPending(null)}
          onConfirm={async (type?: ConnectionType, note?: string) => {
            await createConnection({
              sourceId: pending.sourceId,
              targetId: pending.targetId,
              type,
              note,
            });
            setPending(null);
            toast("连接已建立", "quiet");
          }}
        />
      ) : null}

      {editingEdge && editingConnection ? (
        <EdgeNoteEditor
          connection={editingConnection}
          sourceLabel={labelOf(
            ideas.find((i) => i.id === editingConnection.sourceId)?.title,
            ideas.find((i) => i.id === editingConnection.sourceId)?.content ?? "",
          )}
          targetLabel={labelOf(
            ideas.find((i) => i.id === editingConnection.targetId)?.title,
            ideas.find((i) => i.id === editingConnection.targetId)?.content ?? "",
          )}
          x={editingEdge.x}
          y={editingEdge.y}
          onClose={() => setEditingEdge(null)}
          onSave={(patch) => {
            void updateConnection(editingConnection.id, patch);
            toast("已保存", "quiet");
          }}
          onDelete={() => {
            void deleteConnection(editingConnection.id);
            setEditingEdge(null);
            toast("已断开", "quiet");
          }}
        />
      ) : null}
    </div>
  );
}
