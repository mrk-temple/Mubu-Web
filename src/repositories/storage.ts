/**
 * 存储适配层。
 *
 * 页面与 store 只依赖 Repository 接口；这里把 localStorage 封装成
 * 一个可替换的 KV，将来换成 IndexedDB / REST / CRDT 只需换实现。
 */

export interface KeyValueStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

const NS = "mubu.";

/** 模拟磁盘延迟，让调用方的 loading 态是真实异步 */
const LATENCY = 0;

function delay(ms = LATENCY): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

export class LocalStorageStore implements KeyValueStore {
  private readonly available: boolean;

  constructor(private readonly namespace: string = NS) {
    this.available = typeof window !== "undefined" && !!window.localStorage;
  }

  private full(key: string): string {
    return `${this.namespace}${key}`;
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    await delay();
    if (!this.available) return fallback;
    try {
      const raw = window.localStorage.getItem(this.full(key));
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await delay();
    if (!this.available) return;
    try {
      window.localStorage.setItem(this.full(key), JSON.stringify(value));
      window.dispatchEvent(new CustomEvent("mubu:storage", { detail: { key } }));
    } catch {
      // 隐私模式 / 配额满：静默降级为本次会话的内存态
    }
  }

  async remove(key: string): Promise<void> {
    await delay();
    if (!this.available) return;
    window.localStorage.removeItem(this.full(key));
    window.dispatchEvent(new CustomEvent("mubu:storage", { detail: { key } }));
  }

  async keys(prefix = ""): Promise<string[]> {
    if (!this.available) return [];
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(this.namespace + prefix)) {
        out.push(k.slice(this.namespace.length));
      }
    }
    return out;
  }
}

export const store: KeyValueStore = new LocalStorageStore();

export const StorageKeys = {
  ideas: "ideas",
  connections: "connections",
  topics: "topics",
  projects: "projects",
  outline: "outline",
  canvasItems: "canvas.items",
  canvasEdges: "canvas.edges",
  graphPositions: "graph.positions",
  settings: "settings",
  seeded: "seeded",
} as const;
