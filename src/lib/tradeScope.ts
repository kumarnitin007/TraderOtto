import type { Trade } from "@/types/trade";

export type TradeScope = "all" | "credit_spreads";

export function isCoreCreditSpread(trade: Pick<Trade, "strategy">) {
  return (
    trade.strategy === "Put Credit Spread" ||
    trade.strategy === "Call Credit Spread"
  );
}

export function tradesInScope(trades: Trade[], scope: TradeScope) {
  return scope === "credit_spreads"
    ? trades.filter(isCoreCreditSpread)
    : trades;
}
