"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trade } from "@/types/trade";

export type LiveQuote = { price: number; dir: -1 | 0 | 1 };

async function fetchQuote(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/quote/${encodeURIComponent(symbol)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number };
    return typeof data.price === "number" ? data.price : null;
  } catch {
    return null;
  }
}

export function useTickerQuotes(tickers: string[], initialPrices: Record<string, number> = {}) {
  const tickerKey = Array.from(new Set(tickers.map((ticker) => ticker.toUpperCase())))
    .sort()
    .join(",");
  const symbols = useMemo(() => (tickerKey ? tickerKey.split(",") : []), [tickerKey]);
  const initialKey = symbols
    .map((symbol) => `${symbol}:${initialPrices[symbol] ?? 0}`)
    .join("|");
  const fallbackPrices = useMemo(
    () =>
      Object.fromEntries(
        initialKey
          .split("|")
          .filter(Boolean)
          .map((entry) => {
            const [symbol, price] = entry.split(":");
            return [symbol, Number(price)];
          })
      ),
    [initialKey]
  );
  const [live, setLive] = useState<Record<string, LiveQuote>>({});

  useEffect(() => {
    setLive((prev) => {
      const next = { ...prev };
      symbols.forEach((tk) => {
        if (!next[tk]) {
          next[tk] = { price: fallbackPrices[tk] ?? 0, dir: 0 };
        }
      });
      return next;
    });

    let cancelled = false;

    async function poll() {
      const updates: Record<string, LiveQuote> = {};
      await Promise.all(
        symbols.map(async (tk) => {
          const price = await fetchQuote(tk);
          if (price == null) return;
          updates[tk] = { price, dir: 0 };
        })
      );
      if (cancelled) return;
      setLive((prev) => {
        const next = { ...prev };
        for (const [tk, q] of Object.entries(updates)) {
          const prevPrice = prev[tk]?.price;
          next[tk] = {
            price: q.price,
            dir: prevPrice == null ? 0 : q.price >= prevPrice ? 1 : -1,
          };
        }
        return next;
      });
    }

    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tickerKey, symbols, fallbackPrices]);

  return live;
}

export function useLiveQuotes(trades: Trade[]) {
  const openTrades = useMemo(() => trades.filter((trade) => trade.status === "open"), [trades]);
  const tickers = useMemo(() => openTrades.map((trade) => trade.ticker), [openTrades]);
  const initialPrices = useMemo(
    () =>
      Object.fromEntries(
        openTrades.map((trade) => [trade.ticker, trade.stockPriceOpen ?? 0])
      ),
    [openTrades]
  );
  return useTickerQuotes(tickers, initialPrices);
}
