import type { Connection, GraphPosition, Idea, Topic } from "@/types";
import { forceLayoutDetailed, nodeSizeFor, type LayoutBlock } from "@/lib/forceLayout";
import { clusterKeyFor } from "@/lib/selectors";

/**
 * 思维网络的排布。
 *
 * 力求解交给 lib/forceLayout（Fruchterman–Reingold + 矩形碰撞 + 分量装箱），
 * 这里只负责两件小事：
 *   1. 把 Idea / Connection 翻译成它的输入
 *   2. 把还没有连接的散点单独收拢到主体下方，免得混进主体当噪声
 */

export { nodeSizeFor };


export interface GraphLayout {
  positions: Record<string, GraphPosition>;
  /** 每个主题块的包围盒，用来放极淡的主题名 */
  blocks: Array<LayoutBlock & { label: string }>;
}

export function computeGraphLayoutDetailed(
  ideas: Idea[],
  connections: Connection[],
  topics: Topic[] = [],
  options: { seed?: number; viewport?: { width: number; height: number } } = {},
): GraphLayout {
  if (ideas.length === 0) return { positions: {}, blocks: [] };

  const clusterOf = (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    return idea ? clusterKeyFor(idea, topics) : "__none__";
  };
  const nameOf = (key: string) =>
    key === "__none__" ? "未归类" : (topics.find((t) => t.id === key)?.name ?? "");

  const { positions, blocks } = forceLayoutDetailed(
    ideas.map((i) => ({ id: i.id, ...nodeSizeFor(i) })),
    connections.map((c) => ({ source: c.sourceId, target: c.targetId })),
    {
      seed: options.seed ?? 20260922,
      aspect: options.viewport
        ? options.viewport.width / options.viewport.height
        : 1.45,
      // 一个主题一块；块间留白明显大于块内，才能读出「一块一块」
      clusterOf,
      blockGap: 96,
    },
  );

  return { positions, blocks: blocks.map((b) => ({ ...b, label: nameOf(b.key) })) };
}

export function computeGraphLayout(
  ideas: Idea[],
  connections: Connection[],
  topics: Topic[] = [],
  options: { seed?: number; viewport?: { width: number; height: number } } = {},
): Record<string, GraphPosition> {
  return computeGraphLayoutDetailed(ideas, connections, topics, options).positions;
}
