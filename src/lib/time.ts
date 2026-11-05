/** 轻量时间格式化，避免为几行逻辑引入日期库 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function nowIso(): string {
  return new Date().toISOString();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** 「刚刚」「3 分钟前」「昨天」「Sep 22」 */
export function relativeTime(iso: string, from: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = from - t;

  if (diff < MINUTE) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 2 * DAY) return "昨天";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;

  const d = new Date(t);
  return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
}

/** 「184 days ago」—— Rediscover 使用 */
export function daysAgo(iso: string, from: number = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((from - t) / DAY));
}

export function daysAgoLabel(iso: string, from: number = Date.now()): string {
  const n = daysAgo(iso, from);
  if (n <= 0) return "today";
  if (n === 1) return "1 day ago";
  return `${n} days ago`;
}

export function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
}

export function monthLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayNumber(iso: string): number {
  return new Date(iso).getDate();
}

export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "夜深了，想到什么？";
  if (h < 12) return "早上好。";
  if (h < 18) return "下午好。";
  return "晚上好。";
}
