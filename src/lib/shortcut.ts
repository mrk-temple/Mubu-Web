/** 只负责界面文案；快捷键监听仍由 useHotkey 处理 Ctrl / Meta。 */
export function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

export function shortcutLabel(key: string, shift = false): string {
  return isMacPlatform()
    ? `⌘${shift ? "⇧" : ""}${key}`
    : `Ctrl+${shift ? "Shift+" : ""}${key}`;
}

export function shortcutModifier(): string {
  return isMacPlatform() ? "⌘" : "Ctrl";
}
