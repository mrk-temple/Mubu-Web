import type { Topic } from "@/types";
import { createId } from "@/lib/id";
import { store, StorageKeys } from "./storage";

export interface TopicRepository {
  createTopic(input: { name: string; parentId?: string; color?: string }): Promise<Topic>;
  updateTopic(id: string, patch: Partial<Omit<Topic, "id">>): Promise<Topic | null>;
  deleteTopic(id: string): Promise<void>;
  getTopic(id: string): Promise<Topic | null>;
  listTopics(): Promise<Topic[]>;
  /** 含子主题的 id 列表，用于按主题聚合 */
  getSubtreeIds(id: string): Promise<string[]>;
  replaceAll(topics: Topic[]): Promise<void>;
}

function sortTopics(topics: Topic[]): Topic[] {
  return [...topics].sort((a, b) => {
    const ap = a.parentId ?? "";
    const bp = b.parentId ?? "";
    if (ap !== bp) return ap.localeCompare(bp);
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

class LocalTopicRepository implements TopicRepository {
  async createTopic(input: {
    name: string;
    parentId?: string;
    color?: string;
  }): Promise<Topic> {
    const topics = await store.get<Topic[]>(StorageKeys.topics, []);
    const existing = topics.find(
      (t) => t.name.toLowerCase() === input.name.trim().toLowerCase(),
    );
    if (existing) return existing;

    const topic: Topic = {
      id: createId("topic"),
      name: input.name.trim(),
      parentId: input.parentId,
      color: input.color,
    };
    await store.set(StorageKeys.topics, sortTopics([...topics, topic]));
    return topic;
  }

  async updateTopic(
    id: string,
    patch: Partial<Omit<Topic, "id">>,
  ): Promise<Topic | null> {
    const topics = await store.get<Topic[]>(StorageKeys.topics, []);
    const idx = topics.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const next = { ...topics[idx], ...patch };
    const updated = [...topics];
    updated[idx] = next;
    await store.set(StorageKeys.topics, sortTopics(updated));
    return next;
  }

  async deleteTopic(id: string): Promise<void> {
    const topics = await store.get<Topic[]>(StorageKeys.topics, []);
    const subtree = await this.getSubtreeIds(id);
    const drop = new Set(subtree);
    await store.set(
      StorageKeys.topics,
      topics.filter((t) => !drop.has(t.id)),
    );
  }

  async getTopic(id: string): Promise<Topic | null> {
    const topics = await store.get<Topic[]>(StorageKeys.topics, []);
    return topics.find((t) => t.id === id) ?? null;
  }

  async listTopics(): Promise<Topic[]> {
    const topics = await store.get<Topic[]>(StorageKeys.topics, []);
    return sortTopics(topics);
  }

  async getSubtreeIds(id: string): Promise<string[]> {
    const topics = await store.get<Topic[]>(StorageKeys.topics, []);
    const out = [id];
    let frontier = [id];
    while (frontier.length > 0) {
      const next = topics.filter((t) => t.parentId && frontier.includes(t.parentId));
      for (const t of next) out.push(t.id);
      frontier = next.map((t) => t.id);
    }
    return out;
  }

  async replaceAll(topics: Topic[]): Promise<void> {
    await store.set(StorageKeys.topics, sortTopics(topics));
  }
}

export const topicRepository: TopicRepository = new LocalTopicRepository();
