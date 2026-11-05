import type {
  AppSettings,
  CanvasEdge,
  CanvasItem,
  Connection,
  GraphPosition,
  Idea,
  OutlineNode,
  Project,
  Topic,
  WorkspaceSnapshot,
} from "@/types";
import { nowIso } from "@/lib/time";
import { store, StorageKeys } from "./storage";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  sidebarCollapsed: false,
  sidebarWidth: 236,
  detailWidth: 440,
  welcomeSeen: false,
};

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(patch: Partial<AppSettings>): Promise<AppSettings>;
}

export interface GraphLayoutRepository {
  getPositions(): Promise<Record<string, GraphPosition>>;
  setPosition(ideaId: string, pos: GraphPosition): Promise<void>;
  setPositions(positions: Record<string, GraphPosition>): Promise<void>;
  clear(): Promise<void>;
}

/** 整库导出 / 导入 —— Local First 时代的数据可迁移性 */
export interface WorkspaceRepository {
  exportSnapshot(): Promise<WorkspaceSnapshot>;
  importSnapshot(snapshot: WorkspaceSnapshot, mode: "replace" | "merge"): Promise<void>;
  isSeeded(): Promise<boolean>;
  markSeeded(): Promise<void>;
  reset(): Promise<void>;
}

class LocalSettingsRepository implements SettingsRepository {
  async get(): Promise<AppSettings> {
    const saved = await store.get<Partial<AppSettings>>(StorageKeys.settings, {});
    return { ...DEFAULT_SETTINGS, ...saved };
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const next = { ...current, ...patch };
    await store.set(StorageKeys.settings, next);
    return next;
  }
}

class LocalGraphLayoutRepository implements GraphLayoutRepository {
  async getPositions(): Promise<Record<string, GraphPosition>> {
    return store.get<Record<string, GraphPosition>>(StorageKeys.graphPositions, {});
  }

  async setPosition(ideaId: string, pos: GraphPosition): Promise<void> {
    const all = await this.getPositions();
    await store.set(StorageKeys.graphPositions, { ...all, [ideaId]: pos });
  }

  async setPositions(positions: Record<string, GraphPosition>): Promise<void> {
    await store.set(StorageKeys.graphPositions, positions);
  }

  async clear(): Promise<void> {
    await store.remove(StorageKeys.graphPositions);
  }
}

class LocalWorkspaceRepository implements WorkspaceRepository {
  async exportSnapshot(): Promise<WorkspaceSnapshot> {
    const [
      ideas,
      connections,
      topics,
      projects,
      outlineNodes,
      canvasItems,
      canvasEdges,
      graphPositions,
      settings,
    ] = await Promise.all([
      store.get<Idea[]>(StorageKeys.ideas, []),
      store.get<Connection[]>(StorageKeys.connections, []),
      store.get<Topic[]>(StorageKeys.topics, []),
      store.get<Project[]>(StorageKeys.projects, []),
      store.get<OutlineNode[]>(StorageKeys.outline, []),
      store.get<CanvasItem[]>(StorageKeys.canvasItems, []),
      store.get<CanvasEdge[]>(StorageKeys.canvasEdges, []),
      store.get<Record<string, GraphPosition>>(StorageKeys.graphPositions, {}),
      new LocalSettingsRepository().get(),
    ]);

    return {
      version: 1,
      exportedAt: nowIso(),
      ideas,
      connections,
      topics,
      projects,
      outlineNodes,
      canvasItems,
      canvasEdges,
      graphPositions,
      settings,
    };
  }

  async importSnapshot(
    snapshot: WorkspaceSnapshot,
    mode: "replace" | "merge",
  ): Promise<void> {
    if (mode === "replace") {
      await store.set(StorageKeys.ideas, snapshot.ideas);
      await store.set(StorageKeys.connections, snapshot.connections);
      await store.set(StorageKeys.topics, snapshot.topics);
      await store.set(StorageKeys.projects, snapshot.projects);
      await store.set(StorageKeys.outline, snapshot.outlineNodes);
      await store.set(StorageKeys.canvasItems, snapshot.canvasItems);
      await store.set(StorageKeys.canvasEdges, snapshot.canvasEdges);
      await store.set(StorageKeys.graphPositions, snapshot.graphPositions);
      await store.set(StorageKeys.settings, {
        ...DEFAULT_SETTINGS,
        ...snapshot.settings,
        welcomeSeen: true,
      });
      return;
    }

    const existing = await this.exportSnapshot();
    const ideaIds = new Set(existing.ideas.map((i) => i.id));
    await store.set(StorageKeys.ideas, [
      ...existing.ideas,
      ...snapshot.ideas.filter((i) => !ideaIds.has(i.id)),
    ]);
    await store.set(StorageKeys.connections, [
      ...existing.connections,
      ...snapshot.connections.filter((c) => !existing.connections.some((e) => e.id === c.id)),
    ]);
    await store.set(StorageKeys.topics, [
      ...existing.topics,
      ...snapshot.topics.filter((t) => !existing.topics.some((e) => e.id === t.id)),
    ]);
    await store.set(StorageKeys.projects, [
      ...existing.projects,
      ...snapshot.projects.filter((p) => !existing.projects.some((e) => e.id === p.id)),
    ]);
    await store.set(StorageKeys.outline, [
      ...existing.outlineNodes,
      ...snapshot.outlineNodes.filter((n) => !existing.outlineNodes.some((e) => e.id === n.id)),
    ]);
    await store.set(StorageKeys.canvasItems, [
      ...existing.canvasItems,
      ...snapshot.canvasItems.filter((n) => !existing.canvasItems.some((e) => e.id === n.id)),
    ]);
    await store.set(StorageKeys.canvasEdges, [
      ...existing.canvasEdges,
      ...snapshot.canvasEdges.filter((n) => !existing.canvasEdges.some((e) => e.id === n.id)),
    ]);
    await store.set(StorageKeys.graphPositions, {
      ...existing.graphPositions,
      ...snapshot.graphPositions,
    });
  }

  async isSeeded(): Promise<boolean> {
    return store.get<boolean>(StorageKeys.seeded, false);
  }

  async markSeeded(): Promise<void> {
    await store.set(StorageKeys.seeded, true);
  }

  async reset(): Promise<void> {
    for (const key of Object.values(StorageKeys)) {
      await store.remove(key);
    }
  }
}

export const settingsRepository: SettingsRepository = new LocalSettingsRepository();
export const graphLayoutRepository: GraphLayoutRepository = new LocalGraphLayoutRepository();
export const workspaceRepository: WorkspaceRepository = new LocalWorkspaceRepository();
