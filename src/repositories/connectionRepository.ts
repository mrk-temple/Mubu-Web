import type { Connection, CreateConnectionInput } from "@/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { store, StorageKeys } from "./storage";

export interface ConnectionRepository {
  createConnection(input: CreateConnectionInput): Promise<Connection>;
  updateConnection(
    id: string,
    patch: Partial<Pick<Connection, "type" | "note">>,
  ): Promise<Connection | null>;
  deleteConnection(id: string): Promise<void>;
  getConnection(id: string): Promise<Connection | null>;
  getConnections(ideaId?: string): Promise<Connection[]>;
  /** 返回与 idea 直接相连的 id 集合 */
  getLinkedIds(ideaId: string): Promise<string[]>;
  replaceAll(connections: Connection[]): Promise<void>;
}

function hasIdea(c: Connection, ideaId: string): boolean {
  return c.sourceId === ideaId || c.targetId === ideaId;
}

class LocalConnectionRepository implements ConnectionRepository {
  async createConnection(input: CreateConnectionInput): Promise<Connection> {
    const all = await store.get<Connection[]>(StorageKeys.connections, []);
    const dup = all.find(
      (c) =>
        (c.sourceId === input.sourceId && c.targetId === input.targetId) ||
        (c.sourceId === input.targetId && c.targetId === input.sourceId),
    );
    if (dup) return dup;

    const connection: Connection = {
      id: createId("conn"),
      sourceId: input.sourceId,
      targetId: input.targetId,
      type: input.type,
      note: input.note?.trim() || undefined,
      createdAt: nowIso(),
    };
    await store.set(StorageKeys.connections, [...all, connection]);
    return connection;
  }

  async updateConnection(
    id: string,
    patch: Partial<Pick<Connection, "type" | "note">>,
  ): Promise<Connection | null> {
    const all = await store.get<Connection[]>(StorageKeys.connections, []);
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const next: Connection = {
      ...all[idx],
      ...patch,
      note:
        patch.note === undefined
          ? all[idx].note
          : patch.note.trim() || undefined,
    };
    const updated = [...all];
    updated[idx] = next;
    await store.set(StorageKeys.connections, updated);
    return next;
  }

  async deleteConnection(id: string): Promise<void> {
    const all = await store.get<Connection[]>(StorageKeys.connections, []);
    await store.set(
      StorageKeys.connections,
      all.filter((c) => c.id !== id),
    );
  }

  async getConnection(id: string): Promise<Connection | null> {
    const all = await store.get<Connection[]>(StorageKeys.connections, []);
    return all.find((c) => c.id === id) ?? null;
  }

  async getConnections(ideaId?: string): Promise<Connection[]> {
    const all = await store.get<Connection[]>(StorageKeys.connections, []);
    const list = ideaId ? all.filter((c) => hasIdea(c, ideaId)) : all;
    return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getLinkedIds(ideaId: string): Promise<string[]> {
    const all = await this.getConnections(ideaId);
    const ids = new Set<string>();
    for (const c of all) {
      ids.add(c.sourceId === ideaId ? c.targetId : c.sourceId);
    }
    return [...ids];
  }

  async replaceAll(connections: Connection[]): Promise<void> {
    await store.set(StorageKeys.connections, connections);
  }
}

export const connectionRepository: ConnectionRepository =
  new LocalConnectionRepository();
