import type { Trade } from "@/types/trade";

/** Realized P/L: (premium_open − premium_close) × contracts × 100 */
export function tradePnl(trade: Trade): number | null {
  if (trade.status !== "closed" || trade.premiumClose == null) return null;
  return (trade.premiumOpen - trade.premiumClose) * trade.contracts * 100;
}

export function monthKey(date: string): string {
  const dt = new Date(date + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function weekKey(date: string): string {
  const dt = new Date(date + "T00:00:00");
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diff);
  return `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function startOfWeek(now = new Date()): Date {
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const AVATAR_HUES = ["#1F6FEB", "#8957E5", "#E5484D", "#0EA5A5", "#E2A03F"];

export function tickerAvatarColor(ticker: string): string {
  const i = Math.abs(seedFromString(ticker)) % AVATAR_HUES.length;
  return AVATAR_HUES[i];
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sparkPoints(ticker: string, base: number): number[] {
  const rng = mulberry32(seedFromString(ticker));
  let v = base * 0.985;
  const pts = [v];
  for (let i = 0; i < 13; i++) {
    v += (rng() - 0.48) * base * 0.006;
    pts.push(v);
  }
  return pts;
}

export type PeriodBucket = {
  key: string;
  pnl: number;
  count: number;
  sortDate: string;
};

export function groupClosedTrades(
  trades: Trade[],
  period: "weekly" | "monthly"
): PeriodBucket[] {
  const keyFn = period === "monthly" ? monthKey : weekKey;
  const map = new Map<string, PeriodBucket>();
  trades
    .filter((t) => t.status === "closed")
    .forEach((t) => {
      if (!t.closeDate) return;
      const pnl = tradePnl(t);
      if (pnl == null) return;
      const k = keyFn(t.closeDate);
      const entry = map.get(k);
      if (!entry) {
        map.set(k, { key: k, pnl, count: 1, sortDate: t.closeDate });
      } else {
        entry.pnl += pnl;
        entry.count += 1;
        if (t.closeDate > entry.sortDate) entry.sortDate = t.closeDate;
      }
    });
  return Array.from(map.values()).sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1));
}

export function summarize(trades: Trade[], now = new Date()) {
  const closed = trades.filter((t) => t.status === "closed");
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now);
  const allTime = closed.reduce((s, t) => s + (tradePnl(t) ?? 0), 0);
  const mtd = closed
    .filter((t) => t.closeDate && new Date(t.closeDate + "T00:00:00") >= monthStart)
    .reduce((s, t) => s + (tradePnl(t) ?? 0), 0);
  const wtd = closed
    .filter((t) => t.closeDate && new Date(t.closeDate + "T00:00:00") >= weekStart)
    .reduce((s, t) => s + (tradePnl(t) ?? 0), 0);
  const wins = closed.filter((t) => (tradePnl(t) ?? 0) > 0).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : null;
  return { allTime, mtd, wtd, winRate, closedCount: closed.length, wins };
}
