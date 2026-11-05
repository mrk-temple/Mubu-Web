/**
 * 模糊搜索：子序列匹配 + 词边界加权。
 * 纯函数，未来可整体替换为向量检索而不动 UI。
 */

export interface Searchable {
  id: string;
  title?: string;
  content: string;
  tags: string[];
  favorite?: boolean;
  createdAt?: string;
}

export interface SearchResult<T extends Searchable> {
  item: T;
  score: number;
}

const SCORE_EXACT = 1000;
const SCORE_PREFIX = 400;
const SCORE_SUBSTRING = 200;
const SCORE_SUBSEQUENCE = 80;
const SCORE_TAG = 60;
const PENALTY_GAP = 2;

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** 判断 query 是否为 text 的子序列，并返回得分（越小越好/越大越好由调用方决定） */
function subsequenceScore(text: string, query: string): number | null {
  let ti = 0;
  let score = 0;
  let prevMatch = -2;

  for (let qi = 0; qi < query.length; qi++) {
    const ch = query[qi];
    let found = -1;
    for (let i = ti; i < text.length; i++) {
      if (text[i] === ch) {
        found = i;
        break;
      }
    }
    if (found === -1) return null;

    // 词边界/紧跟上一个命中 → 更像「有意的匹配」
    const boundary =
      found === 0 ||
      text[found - 1] === " " ||
      text[found - 1] === "\n" ||
      found - 1 === prevMatch;
    score += boundary ? 0 : PENALTY_GAP;
    score += found - ti > 6 ? 3 : 0;
    prevMatch = found;
    ti = found + 1;
  }
  return score;
}

export function fuzzyScore(text: string, query: string): number | null {
  const t = normalize(text);
  const q = normalize(query);
  if (!q) return 0;
  if (!t) return null;

  if (t === q) return SCORE_EXACT;
  if (t.startsWith(q)) return SCORE_PREFIX;
  const idx = t.indexOf(q);
  if (idx >= 0) return SCORE_SUBSTRING - Math.min(60, idx);

  const sub = subsequenceScore(t, q);
  if (sub === null) return null;
  return SCORE_SUBSEQUENCE - Math.min(70, sub * 2);
}

export function searchItems<T extends Searchable>(
  items: T[],
  query: string,
  limit = 30,
): SearchResult<T>[] {
  const q = normalize(query);
  if (!q) return [];

  const results: SearchResult<T>[] = [];
  for (const item of items) {
    const body = `${item.title ?? ""}\n${item.content}`;
    let score = fuzzyScore(body, q);
    if (score === null) {
      // 标签命中仍算相关
      const tagHit = item.tags.some((tag) => fuzzyScore(tag, q) !== null);
      if (!tagHit) continue;
      score = SCORE_TAG;
    } else if (item.tags.some((tag) => normalize(tag) === q)) {
      score += SCORE_TAG;
    }
    if (item.favorite) score += 5;
    results.push({ item, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.item.createdAt ?? "").localeCompare(a.item.createdAt ?? "");
  });
  return results.slice(0, limit);
}

/** 在一段文本里找出 query 出现的位置，用于搜索结果高亮 */
export function highlightRanges(
  text: string,
  query: string,
): Array<[number, number]> {
  const q = normalize(query);
  if (!q) return [];
  const t = normalize(text);
  const ranges: Array<[number, number]> = [];
  let from = 0;
  while (from < t.length) {
    const i = t.indexOf(q, from);
    if (i === -1) break;
    ranges.push([i, i + q.length]);
    from = i + q.length;
  }
  return ranges;
}
