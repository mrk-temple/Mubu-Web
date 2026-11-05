import type { Connection, Idea, Project, Topic } from "@/types";

/** 纯读取的派生查询，避免在组件里反复写 filter */

export function ideaById(ideas: Idea[], id: string | null | undefined): Idea | null {
  if (!id) return null;
  return ideas.find((i) => i.id === id) ?? null;
}

/** 一路向上找到根主题：Agent / LLM / Context 都归到 AI */
export function rootTopicId(
  topics: Topic[],
  topicId: string | null | undefined,
  depth = 6,
): string | null {
  if (!topicId) return null;
  const byId = new Map(topics.map((t) => [t.id, t]));
  let cur = topicId;
  for (let i = 0; i < depth; i++) {
    const t = byId.get(cur);
    if (!t) return cur;
    if (!t.parentId) return t.id;
    cur = t.parentId;
  }
  return cur;
}

/** 想法的分块依据：按根主题归拢，没有主题的单独成块 */
export function clusterKeyFor(idea: Idea, topics: Topic[]): string {
  for (const tid of idea.topicIds) {
    const root = rootTopicId(topics, tid);
    if (root) return root;
  }
  return "__none__";
}

export function topicById(topics: Topic[], id: string | null | undefined): Topic | null {
  if (!id) return null;
  return topics.find((t) => t.id === id) ?? null;
}

export function projectById(projects: Project[], id: string | null | undefined): Project | null {
  if (!id) return null;
  return projects.find((p) => p.id === id) ?? null;
}

export interface Neighbor {
  idea: Idea;
  connection: Connection;
  direction: "out" | "in";
}

export function neighborsOf(
  ideaId: string,
  ideas: Idea[],
  connections: Connection[],
): Neighbor[] {
  const out: Neighbor[] = [];
  for (const c of connections) {
    if (c.sourceId === ideaId) {
      const idea = ideas.find((i) => i.id === c.targetId);
      if (idea) out.push({ idea, connection: c, direction: "out" });
    } else if (c.targetId === ideaId) {
      const idea = ideas.find((i) => i.id === c.sourceId);
      if (idea) out.push({ idea, connection: c, direction: "in" });
    }
  }
  return out;
}

export function degreeMap(connections: Connection[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of connections) {
    map.set(c.sourceId, (map.get(c.sourceId) ?? 0) + 1);
    map.set(c.targetId, (map.get(c.targetId) ?? 0) + 1);
  }
  return map;
}

/** Focus Mode 的可见集合：自身 + 1-hop + 2-hop */
export function hopNeighborhood(
  ideaId: string,
  connections: Connection[],
  depth = 2,
): { focus: Set<string>; hop1: Set<string>; hop2: Set<string> } {
  const focus = new Set<string>([ideaId]);
  const hop1 = new Set<string>();
  const hop2 = new Set<string>();

  const adjacency = new Map<string, Set<string>>();
  for (const c of connections) {
    if (!adjacency.has(c.sourceId)) adjacency.set(c.sourceId, new Set());
    if (!adjacency.has(c.targetId)) adjacency.set(c.targetId, new Set());
    adjacency.get(c.sourceId)!.add(c.targetId);
    adjacency.get(c.targetId)!.add(c.sourceId);
  }

  for (const n of adjacency.get(ideaId) ?? []) {
    hop1.add(n);
    if (depth >= 2) {
      for (const m of adjacency.get(n) ?? []) {
        if (m !== ideaId && !hop1.has(m)) hop2.add(m);
      }
    }
  }

  for (const x of hop1) focus.add(x);
  for (const x of hop2) focus.add(x);
  return { focus, hop1, hop2 };
}

export function allTags(ideas: Idea[]): string[] {
  const set = new Set<string>();
  for (const i of ideas) for (const t of i.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function ideasInTopic(topicId: string, ideas: Idea[], subtreeIds: string[]): Idea[] {
  const set = new Set(subtreeIds);
  return ideas.filter((i) => i.topicIds.some((t) => set.has(t)));
}

export function countConnectionsFor(ideaId: string, connections: Connection[]): number {
  return connections.filter((c) => c.sourceId === ideaId || c.targetId === ideaId).length;
}

/** Topic 相关的连接数（两端都在该主题子树内） */
export function connectionsInTopic(
  ideaIds: string[],
  connections: Connection[],
): Connection[] {
  const set = new Set(ideaIds);
  return connections.filter((c) => set.has(c.sourceId) && set.has(c.targetId));
}

export function excerpt(idea: Idea, max = 120): string {
  const text = (idea.title ? `${idea.title}\n` : "") + idea.content;
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
