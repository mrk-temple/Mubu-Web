import {
  SEED_CANVAS_EDGES,
  SEED_CANVAS_ITEMS,
  SEED_CONNECTIONS,
  SEED_IDEAS,
  SEED_OUTLINE,
  SEED_PROJECTS,
  SEED_TOPICS,
} from "./seed";
import { computeGraphLayout } from "@/lib/layout";
import { workspaceRepository } from "@/repositories/workspaceRepository";
import { store, StorageKeys } from "@/repositories/storage";

/**
 * 首次启动时写入示例内容。
 *
 * 目的不是「假装有用户」，而是让排版、连接线、Focus Mode
 * 在第一次打开时就能被真实地看见。设置里可以一键清空。
 */
export async function seedIfEmpty(): Promise<void> {
  const seeded = await workspaceRepository.isSeeded();
  if (seeded) return;

  const existing = await store.get<unknown[]>(StorageKeys.ideas, []);
  if (existing.length > 0) {
    await workspaceRepository.markSeeded();
    return;
  }

  await store.set(StorageKeys.topics, SEED_TOPICS);
  await store.set(StorageKeys.ideas, SEED_IDEAS);
  await store.set(StorageKeys.connections, SEED_CONNECTIONS);
  await store.set(StorageKeys.projects, SEED_PROJECTS);
  await store.set(StorageKeys.outline, SEED_OUTLINE);
  await store.set(StorageKeys.canvasItems, SEED_CANVAS_ITEMS);
  await store.set(StorageKeys.canvasEdges, SEED_CANVAS_EDGES);

  const positions = computeGraphLayout(SEED_IDEAS, SEED_CONNECTIONS, SEED_TOPICS);
  await store.set(StorageKeys.graphPositions, positions);
  await workspaceRepository.markSeeded();
}

/** 设置页「重新载入示例内容」 */
export async function reseed(): Promise<void> {
  await workspaceRepository.reset();
  await seedIfEmpty();
}
