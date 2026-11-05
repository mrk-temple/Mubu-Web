import { type NodeProps, type Node } from "@xyflow/react";
import { memo } from "react";

export interface BlockLabelData extends Record<string, unknown> {
  label: string;
  count: number;
  color?: string;
}

export type BlockLabelNodeType = Node<BlockLabelData, "blockLabel">;

/**
 * 主题块的名字。
 *
 * 刻意不画框、不铺底色 —— 分块靠「聚在一起 + 中间留白」表达，
 * 名字只是一行极淡的字浮在块的上方。
 * 一旦画上方框，整张图就从「思想之网」变成「流程图分区」，线条的美感就没了。
 */
export const BlockLabel = memo(function BlockLabel({ data }: NodeProps<BlockLabelNodeType>) {
  return (
    <div className="pointer-events-none select-none whitespace-nowrap">
      <span
        className="text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: data.color ?? "var(--fg-faint)" }}
      >
        {data.label}
      </span>
      <span className="ml-2 text-[10.5px] tabular-nums text-faint opacity-70">
        {data.count}
      </span>
    </div>
  );
});
