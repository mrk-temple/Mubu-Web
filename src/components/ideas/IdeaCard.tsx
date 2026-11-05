import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Link2,
  MoreHorizontal,
  Paperclip,
  Star,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";
import { shortcutLabel } from "@/lib/shortcut";
import type { Idea } from "@/types";
import {
  Button,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
} from "@/components/ui";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";

const SOURCE_ICON = {
  manual: Paperclip,
  web: Globe,
  book: BookOpen,
  image: ImageIcon,
  other: Link2,
} as const;

export interface IdeaCardProps {
  idea: Idea;
  topicNames: string[];
  projectNames: string[];
  compact?: boolean;
  onConnect?: (ideaId: string) => void;
  showActions?: boolean;
}

/**
 * Idea 卡片 —— 刻意不画边框。
 * 用留白、极浅底色和 hover 时的阴影区分，让它更像一页纸，而不是一个组件。
 */
export const IdeaCard = memo(function IdeaCard({
  idea,
  topicNames,
  projectNames,
  compact = false,
  onConnect,
  showActions = true,
}: IdeaCardProps) {
  const openIdea = useUI((s) => s.openIdea);
  const toast = useUI((s) => s.toast);
  const toggleFavorite = useWorkspace((s) => s.toggleFavorite);
  const deleteIdea = useWorkspace((s) => s.deleteIdea);
  const [hovered, setHovered] = useState(false);

  const SourceIcon = SOURCE_ICON[idea.source?.type ?? "manual"];
  const meta = [...topicNames, ...idea.tags.map((t) => `#${t}`)].slice(0, 3);
  const title = idea.title ?? idea.content.split("\n")[0].slice(0, 30);
  const body = idea.title ? idea.content : idea.content.split("\n").slice(1).join(" ");

  const onDelete = useCallback(async () => {
    await deleteIdea(idea.id);
    useUI.getState().openIdea(null);
    toast("已删除", "quiet");
  }, [deleteIdea, idea.id, toast]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 4, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative rounded-lg px-3 py-3 transition-colors duration-150",
        "hover:bg-[var(--bg-card)] hover:shadow-soft",
        compact && "px-2.5 py-2",
      )}
    >
      <button
        type="button"
        onClick={() => openIdea(idea.id)}
        className="block w-full text-left"
        aria-label={`打开想法：${title}`}
      >
        <h3
          className={cn(
            "text-[15px] font-medium leading-[1.55] tracking-[-0.005em] text-fg",
            !idea.title && "font-normal",
          )}
        >
          {title}
        </h3>
        {body.trim() ? (
          <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[13.5px] leading-[1.75] text-muted">
            {body.trim()}
          </p>
        ) : null}
      </button>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-faint">
        {meta.map((m) => (
          <span key={m} className="truncate">
            {m}
          </span>
        ))}
        {projectNames.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 truncate">
            <FolderOpen size={11} strokeWidth={1.5} />
            {p}
          </span>
        ))}
        {idea.source?.type === "web" && idea.source.url ? (
          <a
            href={idea.source.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-sm hover:text-fg"
          >
            <SourceIcon size={11} strokeWidth={1.5} />
            {idea.source.title ?? "来源"}
            <ArrowUpRight size={10} strokeWidth={1.5} />
          </a>
        ) : null}
        <span className="tabular-nums">{relativeTime(idea.createdAt)}</span>
        {idea.favorite ? (
          <Star size={11} strokeWidth={1.5} className="fill-current text-accent" />
        ) : null}
      </div>

      {/* Hover 才出现的操作，平时完全不参与视觉层级 */}
      <div
        className={cn(
          "absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-line bg-[var(--bg-card)] p-0.5 shadow-soft",
          "transition-opacity duration-150",
          hovered || showActions === false ? "opacity-100" : "opacity-0",
          "group-focus-within:opacity-100 max-sm:static max-sm:ml-auto max-sm:mt-3 max-sm:w-fit max-sm:opacity-100 max-sm:[&_button]:h-10 max-sm:[&_button]:w-10",
        )}
      >
        {onConnect ? (
          <Tooltip label="连接到其他想法" hint="L" side="bottom">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="连接"
              onClick={() => onConnect(idea.id)}
            >
              <Link2 size={13} strokeWidth={1.5} />
            </Button>
          </Tooltip>
        ) : null}
        <ProjectPickerButton idea={idea} />
        <Tooltip
          label={idea.favorite ? "取消收藏" : "收藏"}
          side="bottom"
        >
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={idea.favorite ? "取消收藏" : "收藏"}
            onClick={() => void toggleFavorite(idea.id)}
          >
            <Star
              size={13}
              strokeWidth={1.5}
              className={idea.favorite ? "fill-current text-accent" : ""}
            />
          </Button>
        </Tooltip>
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="更多">
              <MoreHorizontal size={14} strokeWidth={1.5} />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => openIdea(idea.id)} hint="↵">
              打开详情
            </MenuItem>
            {onConnect ? (
              <MenuItem onSelect={() => onConnect(idea.id)} hint="L">
                连接到…
              </MenuItem>
            ) : null}
            <MenuItem
              onSelect={() => {
                void navigator.clipboard?.writeText(idea.content);
                toast("已复制");
              }}
            >
              复制内容
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={onDelete} hint="⌫">
              删除
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </motion.article>
  );
});

function ProjectPickerButton({ idea }: { idea: Idea }) {
  const projects = useWorkspace((s) => s.projects);
  const toggleProjectIdea = useWorkspace((s) => s.toggleProjectIdea);

  return (
    <Menu>
      <Tooltip label="加入项目" side="bottom">
        <MenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="加入项目">
            <FolderOpen size={13} strokeWidth={1.5} />
          </Button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent align="end">
        <MenuItem disabled>加入项目</MenuItem>
        {projects.map((p) => {
          const active = idea.projectIds.includes(p.id);
          return (
            <MenuItem
              key={p.id}
              hint={active ? "✓" : ""}
              onSelect={() => void toggleProjectIdea(p.id, idea.id)}
            >
              {p.name}
            </MenuItem>
          );
        })}
        {projects.length === 0 ? (
          <MenuItem disabled>还没有项目</MenuItem>
        ) : null}
      </MenuContent>
    </Menu>
  );
}

export function IdeaHintRow() {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-faint">
      <span className="flex items-center gap-1.5">
        <Kbd>↵</Kbd> 保存
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>⇧↵</Kbd> 换行
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>{shortcutLabel("↵")}</Kbd> 展开编辑器
      </span>
    </div>
  );
}

