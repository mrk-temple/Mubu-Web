import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Toaster } from "@/components/ui";
import { CommandPalette } from "@/components/command/CommandPalette";
import { QuickCapture } from "@/components/ideas/QuickCapture";
import { IdeaDetailDrawer } from "@/components/ideas/IdeaDetailDrawer";
import { Welcome } from "@/components/layout/Welcome";
import { GlobalHotkeys } from "@/components/layout/GlobalHotkeys";
import { useWorkspace } from "@/stores/useWorkspace";
import { useUI } from "@/stores/useUI";

let startup: Promise<void> | null = null;
function initializeWorkspace() {
  if (!startup) startup = Promise.all([useUI.getState().init(), useWorkspace.getState().init()]).then(() => undefined).catch(error => { startup = null; throw error; });
  return startup;
}

export function AppShell() {
  const location = useLocation();
  const [boot, setBoot] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBoot("loading");
    initializeWorkspace().then(() => { if (!cancelled) setBoot("ready"); }).catch(() => { if (!cancelled) setBoot("error"); });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    // 切页时收起移动端导航，避免遮罩残留
    useUI.getState().setMobileNav(false);
  }, [location.pathname]);

  if (boot !== "ready") return <main className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center bg-bg text-text" role={boot === "error" ? "alert" : "status"}>
    <div className="text-3xl" aria-hidden="true">幕</div>
    <h1>{boot === "error" ? "暂时无法打开工作区" : "正在打开你的思想空间"}</h1>
    <p>{boot === "error" ? "请检查浏览器是否允许本地存储，然后重试。现有数据不会被清空。" : "读取灵感、连接与项目，稍后就好。"}</p>
    {boot === "error" ? <button type="button" onClick={() => setAttempt(value => value + 1)}>重新打开</button> : <span className="h-px w-20 bg-border" />}
  </main>;

  return (
    <div className="group/sidebar flex h-full min-h-0 w-full overflow-hidden bg-bg">
      <GlobalHotkeys />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>

      <QuickCapture />
      <CommandPalette />
      <IdeaDetailDrawer />
      <Welcome />
      <Toaster />
    </div>
  );
}
