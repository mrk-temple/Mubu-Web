import type { ConnectionSuggestion } from "@/types";

/**
 * 关系建议的类型别名与本地启发式实现。
 *
 * 评分维度刻意拆开（标签重合 / 主题重合 / 词面重合），
 * 未来接 embedding 时只需实现新的 SuggestionProvider，
 * 把 reason 换成语义相似度说明即可，UI 不用改。
 */

export type SuggestionResult = ConnectionSuggestion;

const TAG_WEIGHT = 34;
const TOPIC_WEIGHT = 26;
const TOKEN_WEIGHT = 40;

const STOPWORDS = new Set([
  "的", "了", "是", "在", "和", "也", "就", "都", "而", "与", "及", "或",
  "一个", "我们", "他们", "这个", "那个", "可以", "不是", "因为", "所以",
  "the", "and", "for", "that", "with", "this", "have", "from", "are", "was",
]);

export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const latin = text.toLowerCase().match(/[a-z0-9][a-z0-9\-_.]*/g) ?? [];
  for (const w of latin) {
    if (w.length > 1 && !STOPWORDS.has(w)) tokens.add(w);
  }
  const cjk = text.replace(/[^一-龥]/g, "");
  for (let i = 0; i < cjk.length - 1; i++) {
    const bg = cjk.slice(i, i + 2);
    if (!STOPWORDS.has(bg)) tokens.add(bg);
  }
  return tokens;
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function shareRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const x of a) if (setB.has(x)) shared += 1;
  return shared / Math.min(a.length, b.length);
}

export function createLocalSuggestionProvider(deps: {
  getIdeas: () => import("@/types").Idea[];
  getTopics: () => import("@/types").Topic[];
  getConnections: () => import("@/types").Connection[];
  getLinkedIds: (ideaId: string) => string[];
}): import("@/types").SuggestionProvider {
  return {
    async suggest(ideaId: string, limit = 4): Promise<SuggestionResult[]> {
      const ideas = deps.getIdeas();
      const topics = deps.getTopics();
      const self = ideas.find((i) => i.id === ideaId);
      if (!self) return [];

      const selfTokens = tokenize(`${self.title ?? ""} ${self.content}`);
      const selfTags = self.tags;
      const selfTopics = new Set(self.topicIds);

      const linked = new Set<string>([ideaId, ...deps.getLinkedIds(ideaId)]);
      for (const c of deps.getConnections()) {
        if (c.sourceId === ideaId) linked.add(c.targetId);
        if (c.targetId === ideaId) linked.add(c.sourceId);
      }

      const topicName = (id: string) => topics.find((t) => t.id === id)?.name ?? "";

      const scored: SuggestionResult[] = [];
      for (const other of ideas) {
        if (linked.has(other.id)) continue;

        const tagScore = shareRatio(selfTags, other.tags) * TAG_WEIGHT;
        const sharedTopics = other.topicIds.filter((id) => selfTopics.has(id));
        const topicScore =
          (sharedTopics.length /
            Math.max(1, Math.min(selfTopics.size, other.topicIds.length || 1))) *
          TOPIC_WEIGHT;
        const tokenScore =
          overlapRatio(selfTokens, tokenize(`${other.title ?? ""} ${other.content}`)) *
          TOKEN_WEIGHT;

        const raw = tagScore + topicScore + tokenScore;
        if (raw < 8) continue;

        const score = Math.round(Math.min(0.98, 0.35 + raw / 100) * 100) / 100;
        if (score <= 0.45) continue;

        const sharedTags = selfTags.filter((t) => other.tags.includes(t));
        const reason =
          sharedTopics.length > 0
            ? `同属 ${sharedTopics.map(topicName).filter(Boolean).join(" / ")}`
            : sharedTags.length > 0
              ? `共享标签 ${sharedTags.join(" · ")}`
              : "用词与语境相近";

        scored.push({ ideaId: other.id, score, reason });
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit);
    },
  };
}

export const SUGGESTION_THRESHOLD = 0.5;
