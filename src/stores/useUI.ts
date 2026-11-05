import { create } from "zustand";
import type { ThemeMode } from "@/types";
import { DEFAULT_SETTINGS, settingsRepository } from "@/repositories/workspaceRepository";

export type PaletteMode = "command" | "search";

export interface Toast {
  id: string;
  message: string;
  tone?: "default" | "quiet";
}

interface UIState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  detailWidth: number;
  mobileNavOpen: boolean;
  welcomeSeen: boolean;

  paletteOpen: boolean;
  paletteMode: PaletteMode;
  quickCaptureOpen: boolean;
  /** 右侧详情抽屉中打开的 Idea */
  activeIdeaId: string | null;
  /** Focus 模式下锁定的 Idea（思维网络） */
  focusIdeaId: string | null;
  toasts: Toast[];

  init: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setDetailWidth: (w: number) => void;
  setMobileNav: (v: boolean) => void;

  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
  openQuickCapture: (seed?: string) => void;
  closeQuickCapture: () => void;
  quickCaptureSeed: string;

  openIdea: (id: string | null) => void;
  setFocusIdea: (id: string | null) => void;
  dismissWelcome: () => void;
  showWelcomeAgain: () => void;

  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
}

let toastSeq = 0;

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  // 额外写一份纯字符串键，供 <head> 里的防闪烁脚本在 React 起来之前读到
  try {
    window.localStorage.setItem("mubu.theme", theme);
  } catch {
    /* 隐私模式：忽略 */
  }
}

export const useUI = create<UIState>()((set, get) => ({
  theme: "light",
  sidebarCollapsed: false,
  sidebarWidth: DEFAULT_SETTINGS.sidebarWidth,
  detailWidth: DEFAULT_SETTINGS.detailWidth,
  mobileNavOpen: false,
  welcomeSeen: false,
  paletteOpen: false,
  paletteMode: "command",
  quickCaptureOpen: false,
  quickCaptureSeed: "",
  activeIdeaId: null,
  focusIdeaId: null,
  toasts: [],

  init: async () => {
    const settings = await settingsRepository.get();
    applyTheme(settings.theme);
    set({
      theme: settings.theme,
      sidebarCollapsed: settings.sidebarCollapsed,
      sidebarWidth: settings.sidebarWidth,
      detailWidth: settings.detailWidth,
      welcomeSeen: settings.welcomeSeen,
    });
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    void settingsRepository.update({ theme });
  },

  toggleTheme: () => {
    const next: ThemeMode = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },

  setSidebarCollapsed: (v) => {
    set({ sidebarCollapsed: v });
    void settingsRepository.update({ sidebarCollapsed: v });
  },

  toggleSidebar: () => get().setSidebarCollapsed(!get().sidebarCollapsed),

  setSidebarWidth: (w) => {
    set({ sidebarWidth: w });
    void settingsRepository.update({ sidebarWidth: w });
  },

  setDetailWidth: (w) => {
    set({ detailWidth: w });
    void settingsRepository.update({ detailWidth: w });
  },
  setMobileNav: (v) => set({ mobileNavOpen: v }),

  openPalette: (mode = "command") => set({ paletteOpen: true, paletteMode: mode }),
  closePalette: () => set({ paletteOpen: false }),

  openQuickCapture: (seed = "") =>
    set({ quickCaptureOpen: true, quickCaptureSeed: seed, paletteOpen: false }),
  closeQuickCapture: () => set({ quickCaptureOpen: false, quickCaptureSeed: "" }),

  openIdea: (id) => set({ activeIdeaId: id }),
  setFocusIdea: (id) => set({ focusIdeaId: id }),

  dismissWelcome: () => {
    set({ welcomeSeen: true });
    void settingsRepository.update({ welcomeSeen: true });
  },

  showWelcomeAgain: () => {
    set({ welcomeSeen: false });
    void settingsRepository.update({ welcomeSeen: false });
  },

  toast: (message, tone = "default") => {
    const id = `t${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    window.setTimeout(() => get().dismissToast(id), 2200);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export { DEFAULT_SETTINGS };
