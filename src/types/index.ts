/**
 * 幕布 — 核心数据模型
 *
 * 信息演化路径：
 *   Idea → Connection → Topic/Cluster → Project → Article / Book
 */

export type SourceType = "manual" | "web" | "book" | "image" | "other";

export interface IdeaSource {
  type: SourceType;
  url?: string;
  title?: string;
}

export interface Idea {
  id: string;
  title?: string;
  content: string;
  tags: string[];
  topicIds: string[];
  projectIds: string[];
  source?: IdeaSource;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateIdeaInput = {
  content: string;
  title?: string;
  tags?: string[];
  topicIds?: string[];
  projectIds?: string[];
  source?: IdeaSource;
  favorite?: boolean;
};

export type UpdateIdeaInput = Partial<
  Omit<Idea, "id" | "createdAt" | "updatedAt">
>;

/** 关系类型刻意保持轻量：可以不填。 */
export type ConnectionType =
  | "related"
  | "inspired"
  | "supports"
  | "conflicts"
  | "extends"
  | "source";

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  type?: ConnectionType;
  /** 「为什么我当时把它们连起来？」 */
  note?: string;
  createdAt: string;
}

export type CreateConnectionInput = {
  sourceId: string;
  targetId: string;
  type?: ConnectionType;
  note?: string;
};

export interface Topic {
  id: string;
  name: string;
  parentId?: string;
  /** 低饱和色相，用于节点与连接线 */
  color?: string;
}

export type OutlineNodeKind = "chapter" | "section" | "idea";

export interface OutlineNode {
  id: string;
  projectId: string;
  parentId: string | null;
  kind: OutlineNodeKind;
  title: string;
  ideaId?: string;
  order: number;
}

export type CanvasItemKind = "idea" | "text" | "group" | "frame";

export interface CanvasItem {
  id: string;
  projectId: string;
  kind: CanvasItemKind;
  /** kind === "idea" 时指向一个 Idea */
  ideaId?: string;
  /** kind === "text" | "group" | "frame" 时的自由文本 */
  text?: string;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  order: number;
}

export interface CanvasEdge {
  id: string;
  projectId: string;
  sourceItemId: string;
  targetItemId: string;
  label?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ideaIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type CreateProjectInput = {
  name: string;
  description?: string;
  ideaIds?: string[];
};

/** 思维网络中 Idea 的落点，单独持久化以免污染 Idea 本体 */
export interface GraphPosition {
  x: number;
  y: number;
}

export type ThemeMode = "light" | "dark";

export interface AppSettings {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  /** 左栏展开宽度 */
  sidebarWidth: number;
  /** 右侧详情栏宽度 */
  detailWidth: number;
  welcomeSeen: boolean;
}

/**
 * 关系建议。当前由本地启发式（标签/主题/词面）生成，
 * 接入 embedding 后仅需替换 SuggestionProvider 的实现。
 */
export interface ConnectionSuggestion {
  ideaId: string;
  score: number;
  reason: string;
}

export interface SuggestionProvider {
  suggest(ideaId: string, limit?: number): Promise<ConnectionSuggestion[]>;
}

export interface WorkspaceSnapshot {
  version: 1;
  exportedAt: string;
  ideas: Idea[];
  connections: Connection[];
  topics: Topic[];
  projects: Project[];
  outlineNodes: OutlineNode[];
  canvasItems: CanvasItem[];
  canvasEdges: CanvasEdge[];
  graphPositions: Record<string, GraphPosition>;
  settings: AppSettings;
}
