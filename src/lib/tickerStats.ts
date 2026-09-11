import type { Trade } from "@/types/trade";
import { monthKey, tradePnl } from "@/lib/pnl";

function calendarDays(from: string, to: string) {
  const start = new Date(from + "T00:00:00").getTime();
  const end = new Date(to + "T00:00:00").getTime();
  return Math.round((end - start) / 86_400_000);
}

/** Closed before expiry date. Same-day expiry is treated as held to expiration. */
export function closedEarly(trade: Trade) {
  if (trade.status !== "closed" || !trade.closeDate) return false;
  return trade.closeDate < trade.expiry;
}

export function tradedTickers(trades: Trade[]) {
  return [...new Set(trades.map((trade) => trade.ticker))].sort();
}

export function tickerStats(trades: Trade[]) {
  const closed = trades.filter((trade) => trade.status === "closed");
  const open = trades.filter((trade) => trade.status === "open");
  const pnls = closed.map((trade) => tradePnl(trade) ?? 0);
  const realized = pnls.reduce((sum, value) => sum + value, 0);
  const wins = pnls.filter((value) => value > 0).length;
  const early = closed.filter(closedEarly);
  const held = closed.filter((trade) => !closedEarly(trade));
  const earlyPnl = early.reduce((sum, trade) => sum + (tradePnl(trade) ?? 0), 0);
  const heldPnl = held.reduce((sum, trade) => sum + (tradePnl(trade) ?? 0), 0);
  const heldDays = closed
    .filter((trade) => trade.closeDate)
    .map((trade) => calendarDays(trade.openDate, trade.closeDate as string));
  const avgHold =
    heldDays.length === 0
      ? null
      : Math.round(heldDays.reduce((sum, days) => sum + days, 0) / heldDays.length);

  return {
    total: trades.length,
    closed: closed.length,
    open: open.length,
    realized,
    wins,
    winRate: closed.length ? Math.round((wins / closed.length) * 100) : null,
    earlyCount: early.length,
    heldCount: held.length,
    earlyPnl,
    heldPnl,
    avgHold,
  };
}

export function tickerMonthSplit(trades: Trade[]) {
  const map = new Map<string, { key: string; pnl: number; count: number; sortDate: string }>();
  for (const trade of trades) {
    if (trade.status !== "closed" || !trade.closeDate) continue;
    const pnl = tradePnl(trade);
    if (pnl == null) continue;
    const key = monthKey(trade.closeDate);
    const entry = map.get(key);
    if (!entry) {
      map.set(key, { key, pnl, count: 1, sortDate: trade.closeDate });
    } else {
      entry.pnl += pnl;
      entry.count += 1;
      if (trade.closeDate > entry.sortDate) entry.sortDate = trade.closeDate;
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1));
}
