import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * 面板伸缩手柄。
 *
 * 贴在面板边缘的 7px 命中区，平时几乎不可见，靠近才浮出一根细条 ——
 * 既保证可发现，又不让它参与视觉层级。
 * 双击可在「窄 / 宽」两档之间切换。
 */
export function PanelResizer({
  side,
  width,
  min,
  max,
  narrow,
  wide,
  onWidthChange,
  onToggle,
  label,
}: {
  /** 手柄贴在哪一侧边缘 */
  side: "left" | "right";
  width: number;
  min: number;
  max: number;
  /** 双击切换时的两档宽度 */
  narrow: number;
  wide: number;
  onWidthChange: (width: number) => void;
  onToggle?: () => void;
  label: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const startRef = useRef({ x: 0, w: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { x: e.clientX, w: width };
      setDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - startRef.current.x;
      const next = side === "left" ? startRef.current.w + dx : startRef.current.w - dx;
      onWidthChange(Math.round(Math.max(min, Math.min(max, next))));
    },
    [side, min, max, onWidthChange],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={() => {
        if (onToggle) onToggle();
        else onWidthChange(width > (narrow + wide) / 2 ? narrow : wide);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 32 : 8;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onWidthChange(Math.max(min, Math.min(max, width + (side === "left" ? -step : step))));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onWidthChange(Math.max(min, Math.min(max, width + (side === "left" ? step : -step))));
        }
      }}
      className={cn(
        "absolute inset-y-0 z-20 w-[7px] cursor-col-resize touch-none",
        "group flex items-center justify-center outline-none",
        side === "left" ? "-right-[3px]" : "-left-[3px]",
      )}
    >
      <span
        className={cn(
          "h-full w-px transition-colors duration-150",
          dragging
            ? "bg-[var(--accent-line)]"
            : hover
              ? "bg-[var(--line-strong)]"
              : "bg-transparent",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute h-7 w-[3px] rounded-full transition-all duration-150",
          dragging
            ? "scale-y-125 bg-[var(--accent)] opacity-70"
            : hover
              ? "bg-[var(--fg-faint)] opacity-60"
              : "opacity-0",
        )}
      />
    </div>
  );
}
