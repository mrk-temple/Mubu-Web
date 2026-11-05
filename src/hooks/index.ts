import { useEffect, useRef, useState } from "react";

/** 轻量快捷键绑定：输入框内默认不触发（除非 allowInInput） */
export interface HotkeyOptions {
  allowInInput?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  options: HotkeyOptions = {},
) {
  const { allowInInput = false, enabled = true, preventDefault = true } = options;
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const combos = [combo.toLowerCase()];

    const onKey = (e: KeyboardEvent) => {
      if (!allowInInput && isEditable(e.target)) return;
      const parts = [
        e.ctrlKey ? "ctrl" : "",
        e.metaKey ? "meta" : "",
        e.altKey ? "alt" : "",
        e.shiftKey ? "shift" : "",
        e.key.toLowerCase(),
      ].filter(Boolean);
      // meta/ctrl 互换，Windows / macOS 都自然
      const normalized = parts
        .filter((p) => p !== "meta" && p !== "ctrl")
        .join("+");
      const hasMod = e.ctrlKey || e.metaKey;
      const matched = combos.some((c) => {
        const cParts = c.split("+");
        const wantsMod = cParts.includes("meta") || cParts.includes("ctrl");
        const cNorm = cParts.filter((p) => p !== "meta" && p !== "ctrl").join("+");
        return wantsMod === hasMod && cNorm === normalized;
      });
      if (!matched) return;
      if (preventDefault) e.preventDefault();
      ref.current(e);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, allowInInput, enabled, preventDefault]);
}

/** 防抖后的值，编辑器自动保存用 */
export function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}
