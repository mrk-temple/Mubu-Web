import type { CreateIdeaInput, Idea, UpdateIdeaInput } from "@/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { store, StorageKeys } from "./storage";
import { searchItems } from "@/lib/search";

export interface ListIdeasQuery {
  tag?: string;
  topicId?: string;
  projectId?: string;
  favorite?: boolean;
  since?: string;
  until?: string;
}

export interface IdeaRepository {
  createIdea(input: CreateIdeaInput): Promise<Idea>;
  updateIdea(id: string, patch: UpdateIdeaInput): Promise<Idea | null>;
  deleteIdea(id: string): Promise<void>;
  getIdea(id: string): Promise<Idea | null>;
  listIdeas(query?: ListIdeasQuery): Promise<Idea[]>;
  searchIdeas(q: string): Promise<Idea[]>;
  replaceAll(ideas: Idea[]): Promise<void>;
}

function sortByRecency(ideas: Idea[]): Idea[] {
  return [...ideas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function matches(idea: Idea, q: ListIdeasQuery): boolean {
  if (q.tag && !idea.tags.includes(q.tag)) return false;
  if (q.topicId && !idea.topicIds.includes(q.topicId)) return false;
  if (q.projectId && !idea.projectIds.includes(q.projectId)) return false;
  if (q.favorite !== undefined && idea.favorite !== q.favorite) return false;
  if (q.since && idea.createdAt < q.since) return false;
  if (q.until && idea.createdAt > q.until) return false;
  return true;
}

class LocalIdeaRepository implements IdeaRepository {
  async createIdea(input: CreateIdeaInput): Promise<Idea> {
    const ideas = await store.get<Idea[]>(StorageKeys.ideas, []);
    const ts = nowIso();
    const idea: Idea = {
      id: createId("idea"),
      title: input.title?.trim() || undefined,
      content: input.content.trim(),
      tags: [...new Set(input.tags ?? [])],
      topicIds: [...new Set(input.topicIds ?? [])],
      projectIds: [...new Set(input.projectIds ?? [])],
      source: input.source,
      favorite: input.favorite ?? false,
      createdAt: ts,
      updatedAt: ts,
    };
    await store.set(StorageKeys.ideas, [idea, ...ideas]);
    return idea;
  }

  async updateIdea(id: string, patch: UpdateIdeaInput): Promise<Idea | null> {
    const ideas = await store.get<Idea[]>(StorageKeys.ideas, []);
    const idx = ideas.findIndex((i) => i.id === id);
    if (idx === -1) return null;

    const current = ideas[idx];
    const next: Idea = {
      ...current,
      ...patch,
      title:
        patch.title === undefined
          ? current.title
          : patch.title.trim() || undefined,
      tags: patch.tags ? [...new Set(patch.tags)] : current.tags,
      topicIds: patch.topicIds ? [...new Set(patch.topicIds)] : current.topicIds,
      projectIds: patch.projectIds
        ? [...new Set(patch.projectIds)]
        : current.projectIds,
      updatedAt: nowIso(),
    };
    const updated = [...ideas];
    updated[idx] = next;
    await store.set(StorageKeys.ideas, updated);
    return next;
  }

  async deleteIdea(id: string): Promise<void> {
    const ideas = await store.get<Idea[]>(StorageKeys.ideas, []);
    await store.set(
      StorageKeys.ideas,
      ideas.filter((i) => i.id !== id),
    );
  }

  async getIdea(id: string): Promise<Idea | null> {
    const ideas = await store.get<Idea[]>(StorageKeys.ideas, []);
    return ideas.find((i) => i.id === id) ?? null;
  }

  async listIdeas(query: ListIdeasQuery = {}): Promise<Idea[]> {
    const ideas = await store.get<Idea[]>(StorageKeys.ideas, []);
    return sortByRecency(ideas.filter((i) => matches(i, query)));
  }

  async searchIdeas(q: string): Promise<Idea[]> {
    const ideas = await store.get<Idea[]>(StorageKeys.ideas, []);
    return searchItems(ideas, q).map((r) => r.item);
  }

  async replaceAll(ideas: Idea[]): Promise<void> {
    await store.set(StorageKeys.ideas, sortByRecency(ideas));
  }
}

export const ideaRepository: IdeaRepository = new LocalIdeaRepository();
