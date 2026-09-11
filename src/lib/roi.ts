import { isDebitStrategy, type Trade } from "@/types/trade";
import { tradePnl } from "@/lib/pnl";

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;

function calendarDays(from: string, to: string) {
  const start = new Date(from + "T00:00:00").getTime();
  const end = new Date(to + "T00:00:00").getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

function width(left: number | null, right: number | null) {
  if (left == null || right == null) return null;
  const gap = Math.abs(left - right);
  return gap > 0 ? gap : null;
}

/**
 * Cash tied up while the trade is open: spread width (minus credit) for
 * defined-risk, strike × 100 for cash-secured puts, stock × 100 for covered
 * calls, and premium paid for debit/long positions.
 */
export function capitalUsed(trade: Trade): number | null {
  const n = trade.contracts;
  if (!n || n <= 0) return null;
  const premium = Math.abs(trade.premiumOpen);
  const credit = isDebitStrategy(trade.strategy) ? 0 : premium;
  const debit = isDebitStrategy(trade.strategy) ? premium : 0;
  const strategy = trade.strategy;

  if (strategy === "Long Call" || strategy === "Long Put") {
    const cash = debit * n * 100;
    return cash > 0 ? cash : null;
  }

  if (strategy === "Put Debit Spread" || strategy === "Call Debit Spread") {
    const cash = debit * n * 100;
    if (cash > 0) return cash;
    const spread = width(trade.shortStrike, trade.longStrike);
    return spread != null ? spread * n * 100 : null;
  }

  if (strategy === "Put Credit Spread" || strategy === "Call Credit Spread") {
    const spread = width(trade.shortStrike, trade.longStrike);
    if (spread == null) return null;
    return Math.max(spread - credit, 0) * n * 100;
  }

  if (strategy === "Iron Condor") {
    const putWidth = width(trade.shortStrike, trade.longStrike);
    const callWidth = width(trade.callShortStrike, trade.callLongStrike);
    const spread = Math.max(putWidth ?? 0, callWidth ?? 0);
    if (spread <= 0) return null;
    return Math.max(spread - credit, 0) * n * 100;
  }

  if (strategy === "Cash-Secured Put") {
    if (trade.shortStrike == null || trade.shortStrike <= 0) return null;
    return trade.shortStrike * n * 100;
  }

  if (strategy === "Covered Call") {
    const px = trade.stockPriceOpen > 0 ? trade.stockPriceOpen : trade.shortStrike;
    if (px == null || px <= 0) return null;
    return px * n * 100;
  }

  if (strategy === "Strangle") {
    if (trade.shortStrike == null || trade.shortStrike <= 0) return null;
    return trade.shortStrike * n * 100;
  }

  const spread = width(trade.shortStrike, trade.longStrike);
  if (spread != null) return Math.max(spread - credit, 0) * n * 100;
  if (debit > 0) return debit * n * 100;
  if (trade.shortStrike != null && trade.shortStrike > 0) return trade.shortStrike * n * 100;
  return null;
}

export type TradeRoi = {
  pnl: number;
  capital: number;
  days: number;
  roi: number;
  annualized: number;
};

/** Closed-trade ROI and simple annualized ROI (prorated 365 / days blocked). */
export function tradeRoi(trade: Trade): TradeRoi | null {
  if (trade.status !== "closed" || !trade.closeDate) return null;
  const pnl = tradePnl(trade);
  const capital = capitalUsed(trade);
  if (pnl == null || capital == null || capital <= 0) return null;
  const days = Math.max(1, calendarDays(trade.openDate, trade.closeDate));
  const roi = pnl / capital;
  return { pnl, capital, days, roi, annualized: roi * (DAYS_PER_YEAR / days) };
}

export function fmtPct(value: number) {
  const abs = Math.abs(value * 100);
  const digits = abs >= 100 ? 0 : 1;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${abs.toFixed(digits)}%`;
}
