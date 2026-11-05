import { create } from "zustand";
import type {
  CanvasEdge,
  CanvasItem,
  Connection,
  ConnectionType,
  CreateIdeaInput,
  Idea,
  OutlineNode,
  OutlineNodeKind,
  Project,
  Topic,
  WorkspaceSnapshot,
} from "@/types";
import { createId } from "@/lib/id";
import { computeGraphLayout } from "@/lib/layout";
import {
  canvasRepository,
  connectionRepository,
  graphLayoutRepository,
  ideaRepository,
  outlineRepository,
  projectRepository,
  settingsRepository,
  topicRepository,
  workspaceRepository,
} from "@/repositories";
import { reseed, seedIfEmpty } from "@/data/seedWorkspace";

export interface WorkspaceState {
  ready: boolean;
  ideas: Idea[];
  connections: Connection[];
  topics: Topic[];
  projects: Project[];
  outlineNodes: OutlineNode[];
  canvasItems: CanvasItem[];
  canvasEdges: CanvasEdge[];
  graphPositions: Record<string, { x: number; y: number }>;

  init: () => Promise<void>;

  createIdea: (
    input: CreateIdeaInput & { projectId?: string },
  ) => Promise<Idea>;
  updateIdea: (id: string, patch: Partial<Omit<Idea, "id" | "createdAt" | "updatedAt">>) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;

  createConnection: (input: {
    sourceId: string;
    targetId: string;
    type?: ConnectionType;
    note?: string;
  }) => Promise<Connection>;
  updateConnection: (
    id: string,
    patch: Partial<Pick<Connection, "type" | "note">>,
  ) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;

  createTopic: (input: { name: string; parentId?: string; color?: string }) => Promise<Topic>;
  updateTopic: (id: string, patch: Partial<Omit<Topic, "id">>) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;

  createProject: (input: { name: string; description?: string }) => Promise<Project>;
  updateProject: (
    id: string,
    patch: Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setProjectIdeas: (projectId: string, ideaIds: string[]) => Promise<void>;
  toggleProjectIdea: (projectId: string, ideaId: string) => Promise<void>;

  addOutlineNode: (input: {
    projectId: string;
    parentId: string | null;
    kind: OutlineNodeKind;
    title: string;
    ideaId?: string;
  }) => Promise<void>;
  updateOutlineNode: (
    id: string,
    patch: Partial<Pick<OutlineNode, "title" | "kind" | "ideaId">>,
  ) => Promise<void>;
  removeOutlineNode: (id: string) => Promise<void>;
  reorderOutlineNode: (id: string, index: number, parentId: string | null) => Promise<void>;

  saveCanvasItem: (item: CanvasItem) => Promise<void>;
  updateCanvasItem: (id: string, patch: Partial<CanvasItem>) => Promise<void>;
  removeCanvasItem: (id: string) => Promise<void>;
  saveCanvasEdge: (edge: Omit<CanvasEdge, "id"> & { id?: string }) => Promise<void>;
  removeCanvasEdge: (id: string) => Promise<void>;
  createCanvasIdeaItem: (projectId: string, ideaId: string, x: number, y: number) => Promise<void>;

  setGraphPosition: (ideaId: string, pos: { x: number; y: number }) => Promise<void>;
  resetGraphLayout: (viewport?: { width: number; height: number }) => Promise<void>;

  exportSnapshot: () => Promise<WorkspaceSnapshot>;
  importSnapshot: (snapshot: WorkspaceSnapshot, mode: "replace" | "merge") => Promise<void>;
  clearAllData: () => Promise<void>;
  loadSampleData: () => Promise<void>;
}

function withoutId<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

/** 项目成员以 Project.ideaIds 为准，避免刷新后 Idea.projectIds 留在旧状态。 */
function reconcileProjectLinks(ideas: Idea[], projects: Project[]): { ideas: Idea[]; changed: boolean } {
  let changed = false;
  const next = ideas.map((idea) => {
    const projectIds = projects.filter((project) => project.ideaIds.includes(idea.id)).map((project) => project.id);
    if (projectIds.length === idea.projectIds.length && projectIds.every((id) => idea.projectIds.includes(id))) return idea;
    changed = true;
    return { ...idea, projectIds };
  });
  return { ideas: next, changed };
}

async function refreshProjectLinks(ideas: Idea[]): Promise<{ ideas: Idea[]; projects: Project[] }> {
  const projects = await projectRepository.listProjects();
  const reconciled = reconcileProjectLinks(ideas, projects);
  if (reconciled.changed) await ideaRepository.replaceAll(reconciled.ideas);
  return { ideas: reconciled.ideas, projects };
}

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  ready: false,
  ideas: [],
  connections: [],
  topics: [],
  projects: [],
  outlineNodes: [],
  canvasItems: [],
  canvasEdges: [],
  graphPositions: {},

  init: async () => {
    if (get().ready) return;
    await seedIfEmpty();
    const [storedIdeas, connections, topics, projects, outlineNodes, canvasItems, canvasEdges, graphPositions] =
      await Promise.all([
        ideaRepository.listIdeas(),
        connectionRepository.getConnections(),
        topicRepository.listTopics(),
        projectRepository.listProjects(),
        outlineRepository.listAll(),
        canvasRepository.listAllItems(),
        canvasRepository.listAllEdges(),
        graphLayoutRepository.getPositions(),
      ]);

    const reconciled = reconcileProjectLinks(storedIdeas, projects);
    const ideas = reconciled.ideas;
    if (reconciled.changed) await ideaRepository.replaceAll(ideas);

    let positions = graphPositions;
    const missing = ideas.some((i) => !positions[i.id]);
    if (missing) {
      positions = {
        ...computeGraphLayout(ideas, connections, topics, { seed: 20260922 }),
        ...positions,
      };
    }

    set({
      ideas,
      connections,
      topics,
      projects,
      outlineNodes,
      canvasItems,
      canvasEdges,
      graphPositions: positions,
      ready: true,
    });
  },

  createIdea: async (input) => {
    const { projectId, ...rest } = input;
    const idea = await ideaRepository.createIdea(rest);
    if (projectId) {
      await projectRepository.addIdeaToProject(projectId, idea.id);
    }
    const { ideas, projects } = await refreshProjectLinks([idea, ...get().ideas]);
    set({ ideas, projects });
    return ideas.find((item) => item.id === idea.id) ?? idea;
  },

  updateIdea: async (id, patch) => {
    const next = await ideaRepository.updateIdea(id, patch);
    if (!next) return;
    set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? next : i)) }));
  },

  deleteIdea: async (id) => {
    await ideaRepository.deleteIdea(id);
    const connections = await connectionRepository.getConnections();
    const projects = await projectRepository.listProjects();
    const outlineNodes = await outlineRepository.listAll();
    const canvasItems = (await canvasRepository.listAllItems()).filter((i) => i.ideaId !== id);
    set((s) => ({
      ideas: withoutId(s.ideas, id),
      connections,
      projects,
      outlineNodes,
      canvasItems,
    }));
  },

  toggleFavorite: async (id) => {
    const current = get().ideas.find((i) => i.id === id);
    if (!current) return;
    await get().updateIdea(id, { favorite: !current.favorite });
  },

  createConnection: async (input) => {
    const connection = await connectionRepository.createConnection(input);
    set((s) =>
      s.connections.some((c) => c.id === connection.id)
        ? { connections: s.connections.map((c) => (c.id === connection.id ? connection : c)) }
        : { connections: [...s.connections, connection] },
    );
    return connection;
  },

  updateConnection: async (id, patch) => {
    const next = await connectionRepository.updateConnection(id, patch);
    if (!next) return;
    set((s) => ({
      connections: s.connections.map((c) => (c.id === id ? next : c)),
    }));
  },

  deleteConnection: async (id) => {
    await connectionRepository.deleteConnection(id);
    set((s) => ({ connections: withoutId(s.connections, id) }));
  },

  createTopic: async (input) => {
    const topic = await topicRepository.createTopic(input);
    set((s) =>
      s.topics.some((t) => t.id === topic.id)
        ? { topics: s.topics }
        : { topics: [...s.topics, topic] },
    );
    return topic;
  },

  updateTopic: async (id, patch) => {
    const next = await topicRepository.updateTopic(id, patch);
    if (!next) return;
    set((s) => ({ topics: s.topics.map((t) => (t.id === id ? next : t)) }));
  },

  deleteTopic: async (id) => {
    await topicRepository.deleteTopic(id);
    const topics = await topicRepository.listTopics();
    set((s) => ({
      topics,
      ideas: s.ideas.map((i) => ({
        ...i,
        topicIds: i.topicIds.filter((t) => t !== id),
      })),
    }));
  },

  createProject: async (input) => {
    const project = await projectRepository.createProject(input);
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  updateProject: async (id, patch) => {
    const next = await projectRepository.updateProject(id, patch);
    if (!next) return;
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? next : p)) }));
  },

  deleteProject: async (id) => {
    await projectRepository.deleteProject(id);
    const { ideas, projects } = await refreshProjectLinks(get().ideas);
    const outlineNodes = await outlineRepository.listAll();
    const canvasItems = await canvasRepository.listAllItems();
    const canvasEdges = await canvasRepository.listAllEdges();
    set({
      projects,
      ideas,
      outlineNodes,
      canvasItems,
      canvasEdges,
    });
  },

  setProjectIdeas: async (projectId, ideaIds) => {
    await projectRepository.setProjectIdeas(projectId, ideaIds);
    const { ideas, projects } = await refreshProjectLinks(get().ideas);
    set({ projects, ideas });
  },

  toggleProjectIdea: async (projectId, ideaId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const inProject = project.ideaIds.includes(ideaId);
    if (inProject) await projectRepository.removeIdeaFromProject(projectId, ideaId);
    else await projectRepository.addIdeaToProject(projectId, ideaId);

    const { ideas, projects } = await refreshProjectLinks(get().ideas);
    set({ projects, ideas });
  },

  addOutlineNode: async (input) => {
    const node = await outlineRepository.appendNode(input);
    set((s) => ({ outlineNodes: [...s.outlineNodes, node] }));
  },

  updateOutlineNode: async (id, patch) => {
    const next = await outlineRepository.updateNode(id, patch);
    if (!next) return;
    set((s) => ({
      outlineNodes: s.outlineNodes.map((n) => (n.id === id ? next : n)),
    }));
  },

  removeOutlineNode: async (id) => {
    await outlineRepository.removeNode(id);
    const outlineNodes = await outlineRepository.listAll();
    set({ outlineNodes });
  },

  reorderOutlineNode: async (id, index, parentId) => {
    await outlineRepository.reorder(id, index, parentId);
    const outlineNodes = await outlineRepository.listAll();
    set({ outlineNodes });
  },

  saveCanvasItem: async (item) => {
    await canvasRepository.saveItem(item);
    set((s) => {
      const exists = s.canvasItems.some((i) => i.id === item.id);
      return {
        canvasItems: exists
          ? s.canvasItems.map((i) => (i.id === item.id ? item : i))
          : [...s.canvasItems, item],
      };
    });
  },

  updateCanvasItem: async (id, patch) => {
    const next = await canvasRepository.updateItem(id, patch);
    if (!next) return;
    set((s) => ({
      canvasItems: s.canvasItems.map((i) => (i.id === id ? next : i)),
    }));
  },

  removeCanvasItem: async (id) => {
    await canvasRepository.removeItem(id);
    const canvasEdges = await canvasRepository.listAllEdges();
    set((s) => ({
      canvasItems: withoutId(s.canvasItems, id),
      canvasEdges,
    }));
  },

  saveCanvasEdge: async (edge) => {
    const full = await canvasRepository.saveEdge(edge);
    set((s) => {
      const exists = s.canvasEdges.some((e) => e.id === full.id);
      return {
        canvasEdges: exists
          ? s.canvasEdges.map((e) => (e.id === full.id ? full : e))
          : [...s.canvasEdges, full],
      };
    });
  },

  removeCanvasEdge: async (id) => {
    await canvasRepository.removeEdge(id);
    set((s) => ({ canvasEdges: withoutId(s.canvasEdges, id) }));
  },

  createCanvasIdeaItem: async (projectId, ideaId, x, y) => {
    const items = get().canvasItems.filter((i) => i.projectId === projectId);
    const item: CanvasItem = {
      id: createId("citem"),
      projectId,
      kind: "idea",
      ideaId,
      x,
      y,
      w: 220,
      h: 140,
      order: items.length,
    };
    await get().saveCanvasItem(item);
  },

  setGraphPosition: async (ideaId, pos) => {
    set((s) => ({ graphPositions: { ...s.graphPositions, [ideaId]: pos } }));
    await graphLayoutRepository.setPosition(ideaId, pos);
  },

  resetGraphLayout: async (viewport) => {
    // 换一个 seed：同样整洁，但确实是重新排的一套
    const positions = computeGraphLayout(
      get().ideas,
      get().connections,
      get().topics,
      { seed: (Date.now() % 100000) + 7, viewport },
    );
    set({ graphPositions: positions });
    await graphLayoutRepository.setPositions(positions);
  },

  exportSnapshot: async () => workspaceRepository.exportSnapshot(),

  importSnapshot: async (snapshot, mode) => {
    await workspaceRepository.importSnapshot(snapshot, mode);
    await get().init();
    set({ ready: false });
    const [ideas, connections, topics, projects, outlineNodes, canvasItems, canvasEdges, graphPositions] =
      await Promise.all([
        ideaRepository.listIdeas(),
        connectionRepository.getConnections(),
        topicRepository.listTopics(),
        projectRepository.listProjects(),
        outlineRepository.listAll(),
        canvasRepository.listAllItems(),
        canvasRepository.listAllEdges(),
        graphLayoutRepository.getPositions(),
      ]);
    set({
      ideas,
      connections,
      topics,
      projects,
      outlineNodes,
      canvasItems,
      canvasEdges,
      graphPositions,
      ready: true,
    });
  },

  clearAllData: async () => {
    await workspaceRepository.reset();
    // 清空是用户的明确选择；刷新时不应再次灌入首次启动的示例内容。
    await workspaceRepository.markSeeded();
    await settingsRepository.update({ welcomeSeen: true });
    set({
      ideas: [],
      connections: [],
      topics: [],
      projects: [],
      outlineNodes: [],
      canvasItems: [],
      canvasEdges: [],
      graphPositions: {},
      ready: true,
    });
  },

  loadSampleData: async () => {
    await reseed();
    set({ ready: false });
    await get().init();
  },
}));
