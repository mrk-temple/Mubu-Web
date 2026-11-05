import { useCallback, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type BaseProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * 随内容自动增高的 textarea。
 *
 * 用在标题上是关键：标题如果用 <input>，长文本会被裁掉且看不见。
 *
 * 高度必须跟着「宽度」一起重算 —— 只在挂载时量一次是不够的：
 * 面板被拖宽拖窄、响应式换行点变化之后，同样的文本会折成不同的行数，
 * 旧高度配上 overflow:hidden 就把多出来的行吃掉了（表现为「字看不见」）。
 * 所以这里用 ResizeObserver 盯着宽度变化。
 */
export const AutoTextarea = function AutoTextarea({
  className,
  value,
  minRows = 1,
  maxRows,
  ...props
}: BaseProps & { minRows?: number; maxRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const lastWidth = useRef(-1);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    let next = el.scrollHeight;
    if (minRows) next = Math.max(next, Math.ceil(lineHeight * minRows));
    if (maxRows) next = Math.min(next, Math.ceil(lineHeight * maxRows));
    el.style.height = `${next}px`;
    lastWidth.current = el.clientWidth;
  }, [minRows, maxRows]);

  useLayoutEffect(resize, [value, resize]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    resize();

    // 宽度一变就重算（拖伸缩手柄 / 断点切换 / 字体替换）
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ref.current && ref.current.clientWidth !== lastWidth.current) resize();
      });
    };

    const observers: Array<{ disconnect(): void }> = [];
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(schedule);
      ro.observe(el);
      observers.push(ro);
    }
    window.addEventListener("resize", schedule);
    // 系统字体到位后行高可能变
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(schedule).catch(() => undefined);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      for (const o of observers) o.disconnect();
    };
  }, [resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      // 输入 / 聚焦时再量一次，覆盖任何未知的度量时机
      onInput={resize}
      onFocus={resize}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent focus:outline-none",
        "[overflow-wrap:anywhere] [word-break:break-word]",
        className,
      )}
      {...props}
    />
  );
};
