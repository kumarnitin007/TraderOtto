import type { OptionMark } from "@/hooks/useOptionMarks";
import type { LiveQuote } from "@/hooks/useLiveQuotes";
import { markPnl, todayISO } from "@/lib/pnl";
import type { Trade } from "@/types/trade";

export type PositionFocusFilter =
  | "focus"
  | "near"
  | "time"
  | "losing"
  | "all";

export type PositionFocus = {
  distancePct: number | null;
  remainingPct: number | null;
  pnl: number | null;
  near: boolean;
  time: boolean;
  losing: boolean;
  focused: boolean;
};

function utc(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

export function positionFocus(
  trade: Trade,
  quote?: LiveQuote,
  mark?: OptionMark
): PositionFocus {
  const spot = quote?.price || null;
  const keyStrikes = [trade.shortStrike, trade.callShortStrike].filter(
    (strike): strike is number => strike != null && strike > 0
  );
  const distancePct =
    spot && keyStrikes.length
      ? Math.min(
          ...keyStrikes.map(
            (strike) => (Math.abs(spot - strike) / spot) * 100
          )
        )
      : null;
  const totalMs = Math.max(utc(trade.expiry) - utc(trade.openDate), 1);
  const remainingMs = Math.max(utc(trade.expiry) - utc(todayISO()), 0);
  const remainingPct = Math.min(100, (remainingMs / totalMs) * 100);
  const pnl = mark ? markPnl(trade, mark.mark) : null;
  const near = distancePct != null && distancePct <= 20;
  const time = remainingPct <= 50;
  const losing = pnl != null && pnl < 0;

  return {
    distancePct,
    remainingPct,
    pnl,
    near,
    time,
    losing,
    focused: near || time || losing,
  };
}

export function matchesPositionFocus(
  focus: PositionFocus,
  filter: PositionFocusFilter
) {
  if (filter === "all") return true;
  if (filter === "near") return focus.near;
  if (filter === "time") return focus.time;
  if (filter === "losing") return focus.losing;
  return focus.focused;
}
