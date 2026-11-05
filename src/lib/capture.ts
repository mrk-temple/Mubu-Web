import type { IdeaSource } from "@/types";

export interface ParsedCapture {
  content: string;
  title?: string;
  tags: string[];
  source?: IdeaSource;
}

/**
 * 快速记录时从文本里就地识别 #标签 与链接。
 * 记录成本要接近于零，所以不在录入后再弹一个表单。
 */
export function parseCapture(raw: string): ParsedCapture {
  const tags = new Set<string>();
  let source: IdeaSource | undefined;

  // URL → 来源
  const urlRe = /(https?:\/\/[^\s<>"')\]]+)/g;
  let content = raw.replace(urlRe, (match) => {
    try {
      const host = new URL(match).hostname.replace(/^www\./, "");
      source = { type: "web", url: match, title: host };
    } catch {
      /* 忽略无法解析的链接 */
    }
    return "";
  });

  // #标签（允许中文）
  content = content.replace(/#([^\s#，。；、,.;:：!！?？]+)/g, (_, tag: string) => {
    const clean = tag.trim();
    if (clean) tags.add(clean);
    return "";
  });

  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 第一行很短且后面还有内容 → 当作标题
  const first = lines[0] ?? "";
  const rest = lines.slice(1).join("\n");
  const title =
    rest.length > 0 && first.length <= 26 && !/[。.！!？?]$/.test(first)
      ? first
      : undefined;

  const body = title ? rest : lines.join("\n");

  return {
    content: (body || first).trim(),
    title,
    tags: [...tags],
    source,
  };
}

export const CAPTURE_PLACEHOLDERS = [
  "刚刚有什么想法？",
  "有什么值得记住？",
  "记录这一刻……",
  "一个突然冒出来的念头？",
  "想到什么了？",
];

export function randomPlaceholder(seed = Date.now()): string {
  return CAPTURE_PLACEHOLDERS[seed % CAPTURE_PLACEHOLDERS.length];
}
