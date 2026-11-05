import { Menu as MenuIcon, MoreHorizontal, Plus, Search } from "lucide-react";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
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
import { useNavigate } from "react-router-dom";
import { shortcutLabel, shortcutModifier } from "@/lib/shortcut";

/**
 * 右上角刻意只留三样东西：Search · + · …
 * 没有头像，没有通知红点 —— 那些都会和内容争夺注意力。
 */
export function TopBar({
  title,
  meta,
  leading,
}: {
  title?: string;
  meta?: string;
  leading?: React.ReactNode;
}) {
  const openPalette = useUI((s) => s.openPalette);
  const openCapture = useUI((s) => s.openQuickCapture);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const theme = useUI((s) => s.theme);
  const setMobileNav = useUI((s) => s.setMobileNav);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const toast = useUI((s) => s.toast);
  const exportSnapshot = useWorkspace((s) => s.exportSnapshot);
  const navigate = useNavigate();

  const onExport = async () => {
    const snapshot = await exportSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mubu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("已导出");
  };

  return (
    <header className="mubu-topbar sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-[var(--bg)]/85 px-4 backdrop-blur-[8px] sm:px-8">
      <Button
        size="icon-sm"
        variant="ghost"
        className="lg:hidden"
        aria-label="打开导航"
        onClick={() => setMobileNav(true)}
      >
        <MenuIcon size={16} strokeWidth={1.5} />
      </Button>

      <div className="min-w-0 flex-1">
        {leading}
        {title ? (
          <div className="flex items-baseline gap-2.5">
            <h1 className="truncate text-[15px] font-medium tracking-[-0.01em] text-fg">
              {title}
            </h1>
            {meta ? (
              <span className="truncate text-[12px] text-faint">{meta}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        <Tooltip label="搜索" hint={shortcutLabel("K")} side="bottom">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="搜索"
            onClick={() => openPalette("search")}
          >
            <Search size={15} strokeWidth={1.5} />
          </Button>
        </Tooltip>

        <Tooltip label="记录一个想法" hint={shortcutLabel("Space", true)} side="bottom">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="记录一个想法"
            onClick={() => openCapture()}
          >
            <Plus size={16} strokeWidth={1.5} />
          </Button>
        </Tooltip>

        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="更多">
              <MoreHorizontal size={16} strokeWidth={1.5} />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => openCapture()} hint="C">
              记录想法
            </MenuItem>
            <MenuItem onSelect={() => openPalette("command")} hint={shortcutLabel("K")}>
              命令面板
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => navigate("/graph")}>打开思维网络</MenuItem>
            <MenuItem onSelect={() => navigate("/timeline")}>时间线</MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={toggleTheme}>
              {theme === "dark" ? "切换到浅色" : "切换到深色"}
            </MenuItem>
            <MenuItem onSelect={onExport}>导出数据</MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => toggleSidebar()}>折叠 / 展开侧边栏</MenuItem>
            <MenuItem onSelect={() => navigate("/settings")} hint={shortcutLabel(",")}>
              设置
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}

export function ShortcutHint() {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
      <Kbd>{shortcutModifier()}</Kbd>
      <Kbd>K</Kbd>
      <span>随时开始</span>
    </span>
  );
}
