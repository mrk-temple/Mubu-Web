import type {
  CanvasEdge,
  CanvasItem,
  CreateProjectInput,
  OutlineNode,
  OutlineNodeKind,
  Project,
} from "@/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { store, StorageKeys } from "./storage";

export interface ProjectRepository {
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(
    id: string,
    patch: Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Project | null>;
  deleteProject(id: string): Promise<void>;
  getProject(id: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  addIdeaToProject(projectId: string, ideaId: string): Promise<Project | null>;
  removeIdeaFromProject(projectId: string, ideaId: string): Promise<Project | null>;
  setProjectIdeas(projectId: string, ideaIds: string[]): Promise<Project | null>;
  replaceAll(projects: Project[]): Promise<void>;
}

export interface OutlineRepository {
  list(projectId: string): Promise<OutlineNode[]>;
  listAll(): Promise<OutlineNode[]>;
  appendNode(input: {
    projectId: string;
    parentId: string | null;
    kind: OutlineNodeKind;
    title: string;
    ideaId?: string;
  }): Promise<OutlineNode>;
  updateNode(id: string, patch: Partial<Pick<OutlineNode, "title" | "kind" | "ideaId">>): Promise<OutlineNode | null>;
  reorder(id: string, targetIndex: number, parentId: string | null): Promise<OutlineNode[]>;
  removeNode(id: string): Promise<void>;
  replaceAll(nodes: OutlineNode[]): Promise<void>;
}

export interface CanvasRepository {
  listItems(projectId: string): Promise<CanvasItem[]>;
  listEdges(projectId: string): Promise<CanvasEdge[]>;
  listAllItems(): Promise<CanvasItem[]>;
  listAllEdges(): Promise<CanvasEdge[]>;
  saveItem(item: CanvasItem): Promise<CanvasItem>;
  updateItem(id: string, patch: Partial<CanvasItem>): Promise<CanvasItem | null>;
  removeItem(id: string): Promise<void>;
  saveEdge(edge: Omit<CanvasEdge, "id"> & { id?: string }): Promise<CanvasEdge>;
  removeEdge(id: string): Promise<void>;
  replaceAll(items: CanvasItem[], edges: CanvasEdge[]): Promise<void>;
}

function touch(p: Project): Project {
  return { ...p, updatedAt: nowIso() };
}

class LocalProjectRepository implements ProjectRepository {
  async createProject(input: CreateProjectInput): Promise<Project> {
    const all = await store.get<Project[]>(StorageKeys.projects, []);
    const ts = nowIso();
    const project: Project = {
      id: createId("proj"),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      ideaIds: [...new Set(input.ideaIds ?? [])],
      createdAt: ts,
      updatedAt: ts,
    };
    await store.set(StorageKeys.projects, [...all, project]);
    return project;
  }

  async updateProject(
    id: string,
    patch: Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Project | null> {
    const all = await store.get<Project[]>(StorageKeys.projects, []);
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const next = touch({ ...all[idx], ...patch });
    const updated = [...all];
    updated[idx] = next;
    await store.set(StorageKeys.projects, updated);
    return next;
  }

  async deleteProject(id: string): Promise<void> {
    const all = await store.get<Project[]>(StorageKeys.projects, []);
    await store.set(
      StorageKeys.projects,
      all.filter((p) => p.id !== id),
    );
  }

  async getProject(id: string): Promise<Project | null> {
    const all = await store.get<Project[]>(StorageKeys.projects, []);
    return all.find((p) => p.id === id) ?? null;
  }

  async listProjects(): Promise<Project[]> {
    const all = await store.get<Project[]>(StorageKeys.projects, []);
    return [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async addIdeaToProject(projectId: string, ideaId: string): Promise<Project | null> {
    const p = await this.getProject(projectId);
    if (!p) return null;
    if (p.ideaIds.includes(ideaId)) return p;
    return this.updateProject(projectId, { ideaIds: [...p.ideaIds, ideaId] });
  }

  async removeIdeaFromProject(
    projectId: string,
    ideaId: string,
  ): Promise<Project | null> {
    const p = await this.getProject(projectId);
    if (!p) return null;
    return this.updateProject(projectId, {
      ideaIds: p.ideaIds.filter((x) => x !== ideaId),
    });
  }

  async setProjectIdeas(projectId: string, ideaIds: string[]): Promise<Project | null> {
    return this.updateProject(projectId, { ideaIds: [...new Set(ideaIds)] });
  }

  async replaceAll(projects: Project[]): Promise<void> {
    await store.set(StorageKeys.projects, projects);
  }
}

function sortOutline(nodes: OutlineNode[]): OutlineNode[] {
  return [...nodes].sort((a, b) => {
    const ap = a.parentId ?? "";
    const bp = b.parentId ?? "";
    if (ap !== bp) return ap < bp ? -1 : 1;
    return a.order - b.order;
  });
}

class LocalOutlineRepository implements OutlineRepository {
  async listAll(): Promise<OutlineNode[]> {
    const all = await store.get<OutlineNode[]>(StorageKeys.outline, []);
    return sortOutline(all);
  }

  async list(projectId: string): Promise<OutlineNode[]> {
    const all = await store.get<OutlineNode[]>(StorageKeys.outline, []);
    return sortOutline(all.filter((n) => n.projectId === projectId));
  }

  async appendNode(input: {
    projectId: string;
    parentId: string | null;
    kind: OutlineNodeKind;
    title: string;
    ideaId?: string;
  }): Promise<OutlineNode> {
    const all = await store.get<OutlineNode[]>(StorageKeys.outline, []);
    const siblings = all.filter(
      (n) => n.projectId === input.projectId && n.parentId === input.parentId,
    );
    const node: OutlineNode = {
      id: createId("out"),
      projectId: input.projectId,
      parentId: input.parentId,
      kind: input.kind,
      title: input.title,
      ideaId: input.ideaId,
      order: siblings.length,
    };
    await store.set(StorageKeys.outline, [...all, node]);
    return node;
  }

  async updateNode(
    id: string,
    patch: Partial<Pick<OutlineNode, "title" | "kind" | "ideaId">>,
  ): Promise<OutlineNode | null> {
    const all = await store.get<OutlineNode[]>(StorageKeys.outline, []);
    const idx = all.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    const next = { ...all[idx], ...patch };
    const updated = [...all];
    updated[idx] = next;
    await store.set(StorageKeys.outline, updated);
    return next;
  }

  async reorder(
    id: string,
    targetIndex: number,
    parentId: string | null,
  ): Promise<OutlineNode[]> {
    const all = await store.get<OutlineNode[]>(StorageKeys.outline, []);
    const moving = all.find((n) => n.id === id);
    if (!moving) return sortOutline(all.filter((n) => n.projectId === ""));

    const rest = all.filter((n) => n.id !== id);
    const siblings = rest
      .filter((n) => n.projectId === moving.projectId && n.parentId === parentId)
      .sort((a, b) => a.order - b.order);

    const clamped = Math.max(0, Math.min(targetIndex, siblings.length));
    siblings.splice(clamped, 0, { ...moving, parentId });

    const renumbered = siblings.map((n, i) => ({ ...n, order: i }));
    const byId = new Map(renumbered.map((n) => [n.id, n]));
    const next = rest.map((n) => byId.get(n.id) ?? n);
    await store.set(StorageKeys.outline, [...next, ...renumbered.filter((n) => !rest.some((r) => r.id === n.id))]);
    return sortOutline(renumbered);
  }

  async removeNode(id: string): Promise<void> {
    const all = await store.get<OutlineNode[]>(StorageKeys.outline, []);
    const drop = new Set<string>([id]);
    let frontier = [id];
    while (frontier.length > 0) {
      const children = all.filter((n) => n.parentId && frontier.includes(n.parentId));
      for (const c of children) drop.add(c.id);
      frontier = children.map((c) => c.id);
    }
    await store.set(
      StorageKeys.outline,
      all.filter((n) => !drop.has(n.id)),
    );
  }

  async replaceAll(nodes: OutlineNode[]): Promise<void> {
    await store.set(StorageKeys.outline, sortOutline(nodes));
  }
}

class LocalCanvasRepository implements CanvasRepository {
  async listAllItems(): Promise<CanvasItem[]> {
    const all = await store.get<CanvasItem[]>(StorageKeys.canvasItems, []);
    return [...all].sort((a, b) => a.order - b.order);
  }

  async listAllEdges(): Promise<CanvasEdge[]> {
    return store.get<CanvasEdge[]>(StorageKeys.canvasEdges, []);
  }

  async listItems(projectId: string): Promise<CanvasItem[]> {
    const all = await store.get<CanvasItem[]>(StorageKeys.canvasItems, []);
    return all
      .filter((i) => i.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async listEdges(projectId: string): Promise<CanvasEdge[]> {
    const all = await store.get<CanvasEdge[]>(StorageKeys.canvasEdges, []);
    return all.filter((e) => e.projectId === projectId);
  }

  async saveItem(item: CanvasItem): Promise<CanvasItem> {
    const all = await store.get<CanvasItem[]>(StorageKeys.canvasItems, []);
    const idx = all.findIndex((i) => i.id === item.id);
    const next = [...all];
    if (idx === -1) next.push(item);
    else next[idx] = item;
    await store.set(StorageKeys.canvasItems, next);
    return item;
  }

  async updateItem(id: string, patch: Partial<CanvasItem>): Promise<CanvasItem | null> {
    const all = await store.get<CanvasItem[]>(StorageKeys.canvasItems, []);
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const next = { ...all[idx], ...patch };
    const updated = [...all];
    updated[idx] = next;
    await store.set(StorageKeys.canvasItems, updated);
    return next;
  }

  async removeItem(id: string): Promise<void> {
    const items = await store.get<CanvasItem[]>(StorageKeys.canvasItems, []);
    const edges = await store.get<CanvasEdge[]>(StorageKeys.canvasEdges, []);
    await store.set(
      StorageKeys.canvasItems,
      items.filter((i) => i.id !== id),
    );
    await store.set(
      StorageKeys.canvasEdges,
      edges.filter((e) => e.sourceItemId !== id && e.targetItemId !== id),
    );
  }

  async saveEdge(edge: Omit<CanvasEdge, "id"> & { id?: string }): Promise<CanvasEdge> {
    const all = await store.get<CanvasEdge[]>(StorageKeys.canvasEdges, []);
    const id = edge.id ?? createId("cedge");
    const full: CanvasEdge = {
      id,
      projectId: edge.projectId,
      sourceItemId: edge.sourceItemId,
      targetItemId: edge.targetItemId,
      label: edge.label,
    };
    const idx = all.findIndex((e) => e.id === id);
    const next = [...all];
    if (idx === -1) next.push(full);
    else next[idx] = full;
    await store.set(StorageKeys.canvasEdges, next);
    return full;
  }

  async removeEdge(id: string): Promise<void> {
    const all = await store.get<CanvasEdge[]>(StorageKeys.canvasEdges, []);
    await store.set(
      StorageKeys.canvasEdges,
      all.filter((e) => e.id !== id),
    );
  }

  async replaceAll(items: CanvasItem[], edges: CanvasEdge[]): Promise<void> {
    await store.set(StorageKeys.canvasItems, items);
    await store.set(StorageKeys.canvasEdges, edges);
  }
}

export const projectRepository: ProjectRepository = new LocalProjectRepository();
export const outlineRepository: OutlineRepository = new LocalOutlineRepository();
export const canvasRepository: CanvasRepository = new LocalCanvasRepository();
