import { useRef, useState } from "react";
import { PageShell } from "@/components/ideas";
import { BrandMark, TopBar } from "@/components/layout";
import { Button, SectionLabel } from "@/components/ui";
import { useUI } from "@/stores/useUI";
import { useWorkspace } from "@/stores/useWorkspace";
import { shortcutLabel } from "@/lib/shortcut";
import type { ThemeMode, WorkspaceSnapshot } from "@/types";

export function SettingsPage() {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const toast = useUI((s) => s.toast);
  const setWelcome = useUI((s) => s.showWelcomeAgain);
  const ideas = useWorkspace((s) => s.ideas);
  const connections = useWorkspace((s) => s.connections);
  const projects = useWorkspace((s) => s.projects);
  const topics = useWorkspace((s) => s.topics);
  const exportSnapshot = useWorkspace((s) => s.exportSnapshot);
  const importSnapshot = useWorkspace((s) => s.importSnapshot);
  const clearAllData = useWorkspace((s) => s.clearAllData);
  const loadSampleData = useWorkspace((s) => s.loadSampleData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
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
    setBusy(false);
    toast("已导出全部数据");
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text) as WorkspaceSnapshot;
      if (!Array.isArray(snapshot.ideas)) throw new Error("bad file");
      await importSnapshot(snapshot, "replace");
      toast("已导入");
    } catch {
      toast("这个文件读不出来", "quiet");
    }
  };

  return (
    <>
      <TopBar title="设置" />
      <PageShell>
        <SectionLabel>外观</SectionLabel>
        <Row
          title="主题"
          desc="默认是浅色。深色会把纸面换成夜里的桌面。"
          action={
            <div className="flex gap-1">
              {(["light", "dark"] as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={
                    "rounded-md border px-3 py-1 text-[12.5px] quiet-hover " +
                    (theme === t
                      ? "border-accent-line bg-[var(--accent-soft)] text-accent"
                      : "border-line text-muted hover:text-fg")
                  }
                >
                  {t === "light" ? "浅色" : "深色"}
                </button>
              ))}
            </div>
          }
        />

        <Divider />

        <SectionLabel>数据</SectionLabel>
        <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
          幕布现在是 Local First：所有想法都存在这台设备的浏览器里，不会上传。
          导出为 JSON 可以带走，也可以在别的机器上导入。
        </p>

        <div className="mt-6 grid grid-cols-2 gap-6 border-y border-line py-5 sm:grid-cols-4">
          <Stat label="Ideas" value={ideas.length} />
          <Stat label="Connections" value={connections.length} />
          <Stat label="Projects" value={projects.length} />
          <Stat label="Topics" value={topics.length} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void onExport()} disabled={busy}>
            导出 JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            导入 JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            onClick={async () => {
              await loadSampleData();
              toast("已载入示例内容");
            }}
          >
            载入示例内容
          </Button>
          <Button
            variant="outline"
            className="text-[#a15c53]"
            onClick={async () => {
              if (!window.confirm("清空后无法恢复，确定吗？")) return;
              await clearAllData();
              toast("已清空", "quiet");
            }}
          >
            清空所有数据
          </Button>
        </div>

        <Divider />

        <SectionLabel>快捷键</SectionLabel>
        <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-muted">
          <Shortcut keys={shortcutLabel("K")} label="命令面板 / 搜索" />
          <Shortcut keys="C" label="快速记录（在任意页面）" />
          <Shortcut keys={shortcutLabel("Space", true)} label="快速记录" />
          <Shortcut keys={shortcutLabel("D", true)} label="切换深浅色" />
          <Shortcut keys={shortcutLabel("\\")} label="折叠侧边栏" />
          <Shortcut keys={shortcutLabel(",")} label="打开设置" />
          <Shortcut keys="Esc" label="关闭当前浮层" />
        </ul>

        <Divider />

        <SectionLabel>关于</SectionLabel>
        <div className="mt-4 flex items-start gap-5">
          <BrandMark className="mt-1 text-accent" />
          <div>
            <p className="editorial text-[18px] text-fg">幕布</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              记录一个点，连接一条线，最终形成一张属于自己的思想之网。
            </p>
            <p className="mt-3 text-[12px] tracking-[0.04em] text-faint">
              让想法彼此相遇。Where thoughts connect.
            </p>
            <button
              type="button"
              onClick={() => {
                useUI.setState({ welcomeSeen: false });
                setWelcome();
              }}
              className="mt-4 rounded-md border border-line px-3 py-1 text-[12.5px] text-muted quiet-hover hover:text-fg"
            >
              重看欢迎页
            </button>
          </div>
        </div>
      </PageShell>
    </>
  );
}

function Divider() {
  return <div className="my-8 h-px bg-[var(--line)]" />;
}

function Row({
  title,
  desc,
  action,
}: {
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex items-start justify-between gap-6">
      <div>
        <p className="text-[14px] text-fg">{title}</p>
        <p className="mt-1 max-w-[46ch] text-[13px] leading-relaxed text-muted">{desc}</p>
      </div>
      {action}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.1em] text-faint">{label}</p>
      <p className="editorial mt-1 text-[24px] tabular-nums text-fg">{value}</p>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <li className="flex items-center justify-between gap-6 border-b border-line py-1.5 last:border-none">
      <span>{label}</span>
      <kbd className="rounded-[5px] border border-line bg-[var(--bg-hover)] px-1.5 py-0.5 text-[11px] text-faint">
        {keys}
      </kbd>
    </li>
  );
}
