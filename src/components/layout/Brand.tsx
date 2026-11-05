import { cn } from "@/lib/cn";

/**
 * 品牌符号：点 → 线 → 点
 * 「记录一个点，连接一条线，最终形成一张网。」
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 22"
      className={cn("h-[18px] w-[10px]", className)}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="6" cy="3.5" r="2.1" fill="currentColor" opacity="0.55" />
      <path
        d="M6 6.4 V 15.4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
        strokeLinecap="round"
      />
      <circle cx="6" cy="18.4" r="2.1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  // 折叠成图标条时，细长的点-线-点会缩成一条缝；
  // 换成一枚方块字标，在 60px 的条里也读得出来。
  if (collapsed) {
    return (
      <div
        aria-label="幕布"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[14px] font-semibold leading-none text-accent"
      >
        幕
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5 pl-1">
      <BrandMark className="shrink-0 text-accent" />
      <div className="flex min-w-0 flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[0.02em] text-fg">幕布</span>
        <span className="mt-1 truncate text-[10.5px] tracking-[0.04em] text-faint">
          Where thoughts connect.
        </span>
      </div>
    </div>
  );
}
