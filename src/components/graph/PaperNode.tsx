import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";
import type { Idea } from "@/types";

export interface PaperNodeData extends Record<string, unknown> {
  idea: Idea;
  topicName: string;
  topicColor?: string;
  degree: number;
  dim: boolean;
  hop: 0 | 1 | 2;
  focused: boolean;
}

export type PaperNodeType = Node<PaperNodeData, "paper">;

/**
 * 思维网络节点 —— 不是流程图方框，是一张漂浮在空间里的纸片。
 * 尺寸随内容轻微浮动，边框几乎不存在，只靠底色与阴影。
 */
export const PaperNode = memo(function PaperNode({ data }: NodeProps<PaperNodeType>) {
  const { idea, topicName, topicColor, hop, focused, degree } = data;

  const label = idea.title ?? idea.content.split("\n")[0].slice(0, 26);
  const body = idea.title
    ? idea.content
    : idea.content.split("\n").slice(1).join(" ");

  return (
    <div
      className={cn(
        "group relative rounded-[10px] border border-[var(--line)] bg-[var(--bg-card)]",
        "px-3.5 py-3 shadow-soft",
        "transition-[opacity,box-shadow,transform] duration-200 ease-[var(--ease-quiet)]",
        hop === 1 && "shadow-[0_0_0_1px_var(--accent-line)]",
        hop === 2 && "border-[var(--line-strong)]",
        focused && "shadow-lift",
      )}
      style={{ width: "100%" }}
    >
      <Handle type="target" position={Position.Left} />

      <div className="pointer-events-none select-none">
        <p
          className={cn(
            "line-clamp-3 text-[13.5px] leading-[1.5] tracking-[-0.005em] text-fg",
            !idea.title && "font-normal",
          )}
        >
          {label}
        </p>
        {body.trim() ? (
          <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-[1.55] text-muted">
            {body.trim()}
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-faint">
          <span
            className="h-[3px] w-[3px] shrink-0 rounded-full"
            style={{ background: topicColor ?? "var(--fg-faint)" }}
          />
          <span className="truncate">{topicName || "未归类"}</span>
          <span className="opacity-50">·</span>
          <span className="shrink-0">{relativeTime(idea.createdAt)}</span>
          {degree > 0 ? (
            <span className="ml-auto shrink-0 tabular-nums">{degree} 条连接</span>
          ) : null}
        </div>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
});
