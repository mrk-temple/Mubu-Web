import {
  CalendarClock,
  Command as CommandIcon,
  CornerDownLeft,
  Diamond,
  FileText,
  Hexagon,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Tag,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CenteredOverlay, DialogTitle, Kbd } from "@/components/ui";
import { searchItems } from "@/lib/search";
import { relativeTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { shortcutLabel } from "@/lib/shortcut";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";

type Row =
  | { kind: "action"; id: string; label: string; hint?: string; icon: typeof Waves; run: () => void }
  | { kind: "header"; id: string; label: string }
  | { kind: "idea"; id: string; label: string; sub?: string; run: () => void }
  | { kind: "project"; id: string; label: string; sub?: string; run: () => void }
  | { kind: "topic"; id: string; label: string; sub?: string; run: () => void };

function isSelectable(row: Row): row is Exclude<Row, { kind: "header" }> {
  return row.kind !== "header";
}

/**
 * Command Palette + 全局搜索。
 * Cmd/Ctrl + K 打开，↑ ↓ Enter 全键盘可用。
 */
export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const mode = useUI((s) => s.paletteMode);
  const close = useUI((s) => s.closePalette);
  const openCapture = useUI((s) => s.openQuickCapture);
  const openIdea = useUI((s) => s.openIdea);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const theme = useUI((s) => s.theme);
  const toast = useUI((s) => s.toast);

  const ideas = useWorkspace((s) => s.ideas);
  const projects = useWorkspace((s) => s.projects);
  const topics = useWorkspace((s) => s.topics);
  const createProject = useWorkspace((s) => s.createProject);

  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(mode === "search" ? "" : "");
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, mode]);

  const actions = useMemo<Row[]>(
    () => [
      {
        kind: "action",
        id: "a-capture",
        label: "Capture Idea",
        hint: "C",
        icon: Sparkles,
        run: () => openCapture(),
      },
      {
        kind: "action",
        id: "a-search",
        label: "Search Ideas",
        hint: shortcutLabel("/"),
        icon: Search,
        run: () => useUI.getState().openPalette("search"),
      },
      {
        kind: "action",
        id: "a-graph",
        label: "Open Graph",
        icon: Hexagon,
        run: () => navigate("/graph"),
      },
      {
        kind: "action",
        id: "a-ideas",
        label: "All Ideas",
        icon: Waves,
        run: () => navigate("/ideas"),
      },
      {
        kind: "action",
        id: "a-project",
        label: "Create Project",
        icon: Diamond,
        run: async () => {
          const name = window.prompt("项目名称");
          if (!name?.trim()) return;
          const p = await createProject({ name: name.trim() });
          toast("Project created");
          navigate(`/projects/${p.id}`);
        },
      },
      {
        kind: "action",
        id: "a-rediscover",
        label: "Rediscover Idea",
        icon: CommandIcon,
        run: () => {
          const pick = ideas[Math.floor(Math.random() * ideas.length)];
          if (pick) openIdea(pick.id);
        },
      },
      {
        kind: "action",
        id: "a-timeline",
        label: "Timeline",
        icon: CalendarClock,
        run: () => navigate("/timeline"),
      },
      {
        kind: "action",
        id: "a-theme",
        label: theme === "dark" ? "Toggle Light Mode" : "Toggle Dark Mode",
        hint: shortcutLabel("D", true),
        icon: theme === "dark" ? Sun : Moon,
        run: () => toggleTheme(),
      },
      {
        kind: "action",
        id: "a-settings",
        label: "Settings",
        hint: shortcutLabel(","),
        icon: Settings,
        run: () => navigate("/settings"),
      },
    ],
    [openCapture, navigate, createProject, toast, ideas, openIdea, theme, toggleTheme],
  );

  const rows = useMemo<Row[]>(() => {
    const q = query.trim();
    if (!q) {
      return mode === "search"
        ? [
            { kind: "header", id: "h-recent", label: "最近" },
            ...ideas.slice(0, 6).map<Row>((i) => ({
              kind: "idea",
              id: i.id,
              label: i.title ?? i.content.split("\n")[0],
              sub: relativeTime(i.createdAt),
              run: () => openIdea(i.id),
            })),
          ]
        : actions;
    }

    const ideaHits = searchItems(ideas, q, 8);
    const projectHits = searchItems(
      projects.map((p) => ({
        id: p.id,
        title: p.name,
        content: p.description ?? "",
        tags: [],
      })),
      q,
      5,
    );
    const topicHits = searchItems(
      topics.map((t) => ({ id: t.id, title: t.name, content: "", tags: [] })),
      q,
      5,
    );

    const matchedActions = actions.filter((a) =>
      a.kind === "action" && a.label.toLowerCase().includes(q.toLowerCase()),
    );

    const out: Row[] = [];
    if (matchedActions.length > 0) {
      out.push({ kind: "header", id: "h-actions", label: "Actions" });
      out.push(...matchedActions);
    }
    if (ideaHits.length > 0) {
      out.push({ kind: "header", id: "h-ideas", label: "Ideas" });
      out.push(
        ...ideaHits.map<Row>((r) => ({
          kind: "idea",
          id: r.item.id,
          label: r.item.title ?? r.item.content.split("\n")[0],
          sub: relativeTime(r.item.createdAt),
          run: () => openIdea(r.item.id),
        })),
      );
    }
    if (projectHits.length > 0) {
      out.push({ kind: "header", id: "h-projects", label: "Projects" });
      out.push(
        ...projectHits.map<Row>((r) => ({
          kind: "project",
          id: r.item.id,
          label: r.item.title ?? "",
          run: () => navigate(`/projects/${r.item.id}`),
        })),
      );
    }
    if (topicHits.length > 0) {
      out.push({ kind: "header", id: "h-topics", label: "Topics" });
      out.push(
        ...topicHits.map<Row>((r) => ({
          kind: "topic",
          id: r.item.id,
          label: r.item.title ?? "",
          run: () => navigate(`/topics/${r.item.id}`),
        })),
      );
    }
    return out;
  }, [query, mode, ideas, projects, topics, actions, openIdea, navigate]);

  const selectable = useMemo(() => rows.filter(isSelectable), [rows]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, selectable.length - 1)));
  }, [selectable.length]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-cursor="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, rows]);

  const run = (row: Row | undefined) => {
    if (!row || !isSelectable(row)) return;
    close();
    window.setTimeout(() => row.run(), 10);
  };

  return (
    <CenteredOverlay
      open={open}
      onOpenChange={(v) => !v && close()}
      width="max-w-[560px]"
      className="top-[10vh] overflow-hidden p-0"
    >
      <DialogTitle className="sr-only">命令面板</DialogTitle>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Search size={15} strokeWidth={1.5} className="shrink-0 text-faint" />
        <input
          ref={inputRef}
          data-testid="palette-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => (c + 1) % Math.max(1, selectable.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => (c - 1 + selectable.length) % Math.max(1, selectable.length));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(selectable[cursor]);
            }
          }}
          placeholder={
            mode === "search" ? "Search your thoughts..." : "输入命令，或搜索想法…"
          }
          aria-label="搜索与命令"
          className="w-full bg-transparent text-[15px] text-fg placeholder:text-faint focus:outline-none"
        />
        <Kbd>ESC</Kbd>
      </div>

      <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-faint">
            什么都没找到。
          </p>
        ) : (
          <ul>
            {rows.map((row) => {
              if (row.kind === "header") {
                return (
                  <li
                    key={`h-${row.id}`}
                    className="px-2.5 pb-1 pt-3 text-[10.5px] font-medium uppercase tracking-[0.1em] text-faint first:pt-1"
                  >
                    {row.label}
                  </li>
                );
              }
              const index = selectable.findIndex((r) => r.id === row.id);
              const active = index === cursor;
              const Icon =
                row.kind === "action"
                  ? row.icon
                  : row.kind === "project"
                    ? Diamond
                    : row.kind === "topic"
                      ? Tag
                      : row.kind === "idea"
                        ? FileText
                        : Waves;
              return (
                <li key={`${row.kind}-${row.id}`}>
                  <button
                    type="button"
                    data-cursor={active}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => run(row)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px]",
                      active ? "bg-[var(--bg-hover)] text-fg" : "text-muted",
                    )}
                  >
                    <Icon size={14} strokeWidth={1.5} className="shrink-0 text-faint" />
                    <span className="flex-1 truncate">{row.label}</span>
                    {"sub" in row && row.sub ? (
                      <span className="text-[11.5px] text-faint">{row.sub}</span>
                    ) : null}
                    {"hint" in row && row.hint ? (
                      <span className="text-[11px] text-faint">{row.hint}</span>
                    ) : null}
                    {active ? (
                      <CornerDownLeft size={12} strokeWidth={1.5} className="text-faint" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> 移动
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> 打开
        </span>
        <span className="ml-auto">幕布 · 让想法彼此相遇</span>
      </div>
    </CenteredOverlay>
  );
}

