import { useHotkey } from "@/hooks";
import { useUI } from "@/stores/useUI";
import { useNavigate } from "react-router-dom";

/** 全局快捷键：整站只在这里绑一次 */
export function GlobalHotkeys() {
  const navigate = useNavigate();
  const openPalette = useUI((s) => s.openPalette);
  const openCapture = useUI((s) => s.openQuickCapture);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const activeIdeaId = useUI((s) => s.activeIdeaId);
  const openIdea = useUI((s) => s.openIdea);

  useHotkey("meta+k", () => openPalette("command"), { allowInInput: true });
  useHotkey("meta+p", () => openPalette("command"), { allowInInput: true });
  useHotkey("meta+/", () => openPalette("search"), { allowInInput: true });
  useHotkey("meta+shift+ ", () => openCapture(), { allowInInput: true });
  useHotkey("meta+shift+d", () => toggleTheme(), { allowInInput: true });
  useHotkey("meta+\\", () => toggleSidebar());
  useHotkey("meta+,", () => navigate("/settings"), { allowInInput: true });
  useHotkey("escape", () => {
    if (useUI.getState().quickCaptureOpen) useUI.getState().closeQuickCapture();
    else if (useUI.getState().paletteOpen) useUI.getState().closePalette();
    else if (activeIdeaId) openIdea(null);
  });

  // 「C」直接进入快速记录 —— 3 秒记下一个念头的关键
  useHotkey(
    "c",
    (e) => {
      const s = useUI.getState();
      if (s.paletteOpen || s.quickCaptureOpen) return;
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      }
      s.openQuickCapture();
    },
    { allowInInput: false },
  );

  return null;
}
