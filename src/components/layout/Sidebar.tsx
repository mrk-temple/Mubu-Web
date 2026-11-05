import { matchPath, NavLink, useLocation } from "react-router-dom";
import {
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  Command,
  Diamond,
  Hexagon,
  Settings,
  Sparkles,
  Waves,
} from "lucide-react";
import { useMemo } from "react";
import { Brand } from "./Brand";
import { Button, Kbd, PanelResizer, Tooltip } from "@/components/ui";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
import { useMediaQuery } from "@/hooks";
import { cn } from "@/lib/cn";
import { shortcutLabel } from "@/lib/shortcut";

/** 折叠后的图标条宽度 */
export const RAIL_WIDTH = 60;
export const SIDEBAR_MIN = 196;
export const SIDEBAR_MAX = 320;

interface NavItem {
  to: string;
  label: string;
  icon: typeof Waves;
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { to: "/", label: "今日", icon: Sparkles, end: true },
  { to: "/ideas", label: "所有灵感", icon: Waves },
  { to: "/graph", label: "思维网络", icon: Hexagon },
  { to: "/projects", label: "项目", icon: Diamond },
  { to: "/timeline", label: "时间线", icon: CalendarClock },
];

const SETTINGS_ITEM: NavItem = { to: "/settings", label: "设置", icon: Settings };

function isActivePath(item: NavItem, pathname: string): boolean {
  return matchPath({ path: item.to, end: item.end ?? false }, pathname) !== null;
}

export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const sidebarWidth = useUI((s) => s.sidebarWidth);
  const setSidebarWidth = useUI((s) => s.setSidebarWidth);
  const toggle = useUI((s) => s.toggleSidebar);
  const openCapture = useUI((s) => s.openQuickCapture);
  const mobileNavOpen = useUI((s) => s.mobileNavOpen);
  const setMobileNav = useUI((s) => s.setMobileNav);

  const topics = useWorkspace((s) => s.topics);
  const projects = useWorkspace((s) => s.projects);
  const ideas = useWorkspace((s) => s.ideas);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const rail = isDesktop && collapsed;
  const width = rail ? RAIL_WIDTH : sidebarWidth;

  const roots = useMemo(() => topics.filter((t) => !t.parentId), [topics]);
  const recentProjects = useMemo(() => [...projects].slice(0, 3), [projects]);

  return (
    <>
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="关闭导航"
          onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-40 bg-scrim/40 lg:hidden"
        />
      ) : null}

      <aside
        data-collapsed={rail || undefined}
        style={{ width }}
        className={cn(
          "mubu-sidebar relative z-50 flex h-full shrink-0 flex-col",
          "border-r border-line bg-[var(--bg-raised)]",
          "fixed inset-y-0 left-0 lg:static",
          "transition-[width,transform] duration-200 ease-[var(--ease-quiet)]",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* 品牌行 */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center",
            rail ? "justify-center" : "justify-between pr-1",
          )}
        >
          <Brand collapsed={rail} />
          {rail ? null : (
            <Tooltip label="折叠侧边栏" hint={shortcutLabel("\\")}>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={toggle}
                aria-label="折叠侧边栏"
                className="text-faint opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100"
              >
                <ChevronsLeft size={15} strokeWidth={1.6} />
              </Button>
            </Tooltip>
          )}
        </div>

        {/* 快速记录 */}
        <div className={cn("shrink-0", rail ? "px-3" : "px-2.5")}>
          <Tooltip label="快速记录" hint="C" side="right">
            <button
              type="button"
              onClick={() => {
                openCapture();
                setMobileNav(false);
              }}
              aria-label="快速记录"
              className={cn(
                "flex items-center gap-2.5 rounded-lg text-fg quiet-hover",
                rail ? "h-9 w-9 justify-center" : "w-full px-2 py-1.5 text-[13.5px]",
              )}
            >
              <Command size={16} strokeWidth={1.6} className="shrink-0 text-accent" />
              {rail ? null : (
                <>
                  <span className="flex-1 text-left">快速记录</span>
                  <Kbd>C</Kbd>
                </>
              )}
            </button>
          </Tooltip>
        </div>

        {/* 主导航 */}
        <nav
          className={cn(
            "mt-3 flex-1 overflow-y-auto overflow-x-hidden",
            rail ? "flex flex-col items-center gap-1 px-0 pb-4" : "px-2.5 pb-4",
          )}
        >
          <ul className={cn("flex flex-col", rail ? "items-center gap-1" : "w-full gap-0.5")}>
            {PRIMARY.map((item) => (
              <li key={item.to}>
                <SideLink item={item} rail={rail} onNavigate={() => setMobileNav(false)} />
              </li>
            ))}
          </ul>

          {rail ? null : (
            <>
              <p className="mt-5 mb-1.5 px-2 text-[10.5px] font-medium uppercase tracking-[0.11em] text-faint">
                主题
              </p>
              <ul className="flex flex-col gap-0.5">
                {roots.map((t) => {
                  const children = topics.filter((c) => c.parentId === t.id);
                  // 计数含子树，否则 AI 这类父主题会显示 0
                  const subtree = new Set([t.id, ...children.map((c) => c.id)]);
                  const count = ideas.filter((i) =>
                    i.topicIds.some((id) => subtree.has(id)),
                  ).length;
                  return (
                    <li key={t.id}>
                      <NavLink
                        to={`/topics/${t.id}`}
                        onClick={() => setMobileNav(false)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2 rounded-md px-2 py-1 text-[13px] quiet-hover",
                            isActive ? "bg-[var(--bg-active)] text-fg" : "text-muted hover:text-fg",
                          )
                        }
                      >
                        <span
                          className="h-[3px] w-[3px] shrink-0 rounded-full"
                          style={{ background: t.color ?? "var(--fg-faint)" }}
                        />
                        <span className="flex-1 truncate">{t.name}</span>
                        <span className="text-[11px] text-faint">{count}</span>
                      </NavLink>
                      {children.length > 0 ? (
                        <ul className="ml-4 flex flex-col gap-0.5 border-l border-line pl-1.5">
                          {children.map((c) => (
                            <li key={c.id}>
                              <NavLink
                                to={`/topics/${c.id}`}
                                onClick={() => setMobileNav(false)}
                                className={({ isActive }) =>
                                  cn(
                                    "block truncate rounded-md px-2 py-[3px] text-[12.5px] quiet-hover",
                                    isActive ? "bg-[var(--bg-active)] text-fg" : "text-muted hover:text-fg",
                                  )
                                }
                              >
                                {c.name}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <p className="mt-5 mb-1.5 px-2 text-[10.5px] font-medium uppercase tracking-[0.11em] text-faint">
                最近项目
              </p>
              <ul className="flex flex-col gap-0.5">
                {recentProjects.map((p) => (
                  <li key={p.id}>
                    <NavLink
                      to={`/projects/${p.id}`}
                      onClick={() => setMobileNav(false)}
                      className={({ isActive }) =>
                        cn(
                          "block truncate rounded-md px-2 py-1 text-[13px] quiet-hover",
                          isActive ? "bg-[var(--bg-active)] text-fg" : "text-muted hover:text-fg",
                        )
                      }
                    >
                      {p.name}
                    </NavLink>
                  </li>
                ))}
                {recentProjects.length === 0 ? (
                  <li className="px-2 py-1 text-[12.5px] text-faint">还没有项目</li>
                ) : null}
              </ul>
            </>
          )}
        </nav>

        {/* 底部：设置 + 展开 */}
        <div
          className={cn(
            "shrink-0 border-t border-line",
            rail ? "flex flex-col items-center gap-1 p-2" : "p-2",
          )}
        >
          <SideLink item={SETTINGS_ITEM} rail={rail} onNavigate={() => setMobileNav(false)} />
          {rail ? (
            <Tooltip label="展开侧边栏" hint={shortcutLabel("\\")}>
              <button
                type="button"
                onClick={toggle}
                aria-label="展开侧边栏"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-faint quiet-hover hover:text-fg"
              >
                <ChevronsRight size={16} strokeWidth={1.6} />
              </button>
            </Tooltip>
          ) : null}
        </div>

        {/* 右边缘伸缩手柄（移动端是浮层，不启用） */}
        {isDesktop && !rail ? (
          <PanelResizer
            side="left"
            width={sidebarWidth}
            min={SIDEBAR_MIN}
            max={SIDEBAR_MAX}
            narrow={SIDEBAR_MIN}
            wide={SIDEBAR_MAX}
            label="调整侧边栏宽度"
            onWidthChange={setSidebarWidth}
          />
        ) : null}
      </aside>
    </>
  );
}

/**
 * 导航项。
 *
 * 折叠时不要把 NavLink 丢给 Radix Tooltip 的 asChild：NavLink 的 className
 * 是函数，Slot 合并 props 时会把它弄坏，导航项因此丢掉布局类、图标失去高度
 * 挤成一坨 —— 这正是「折叠后很难看」的根因。
 * 这里自己算好 isActive，交给 NavLink 一个静态 className。
 */
function SideLink({
  item,
  rail,
  onNavigate,
}: {
  item: NavItem;
  rail: boolean;
  onNavigate: () => void;
}) {
  const { pathname } = useLocation();
  const active = isActivePath(item, pathname);
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={cn(
        "flex items-center rounded-lg quiet-hover",
        rail ? "h-9 w-9 justify-center" : "w-full gap-2.5 px-2 py-1 text-[13.5px]",
        active ? "bg-[var(--bg-active)] text-fg" : "text-muted hover:text-fg",
      )}
    >
      <Icon size={16} strokeWidth={1.6} className="shrink-0" />
      {rail ? null : <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  return rail ? (
    <Tooltip label={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
