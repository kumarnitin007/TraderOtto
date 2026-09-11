"use client";

import { useMemo } from "react";
import type { Trade } from "@/types/trade";
import { useLiveMarket } from "@/hooks/useLiveMarket";

export type LiveQuote = { price: number; dir: -1 | 0 | 1 };

export function useTickerQuotes(tickers: string[], initialPrices: Record<string, number> = {}) {
  const { quotes } = useLiveMarket();
  const tickerKey = Array.from(new Set(tickers.map((ticker) => ticker.toUpperCase())))
    .sort()
    .join(",");

  return useMemo(() => {
    const symbols = tickerKey ? tickerKey.split(",") : [];
    const next: Record<string, LiveQuote> = {};
    for (const symbol of symbols) {
      next[symbol] =
        quotes[symbol] ??
        (initialPrices[symbol] != null ? { price: initialPrices[symbol], dir: 0 } : { price: 0, dir: 0 });
    }
    return next;
    // initialPrices is first-paint fallback only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, quotes]);
}

export function useLiveQuotes(trades: Trade[]) {
  const openTrades = useMemo(() => trades.filter((trade) => trade.status === "open"), [trades]);
  const tickers = useMemo(() => openTrades.map((trade) => trade.ticker), [openTrades]);
  const initialPrices = useMemo(
    () =>
      Object.fromEntries(openTrades.map((trade) => [trade.ticker, trade.stockPriceOpen ?? 0])),
    [openTrades]
  );
  return useTickerQuotes(tickers, initialPrices);
}
