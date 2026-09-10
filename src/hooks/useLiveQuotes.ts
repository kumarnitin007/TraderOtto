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

export function useLiveQuotes(trades: Trade[]) {
  const openTickers = useMemo(
    () => Array.from(new Set(trades.filter((t) => t.status === "open").map((t) => t.ticker))),
    [trades]
  );

  const [live, setLive] = useState<Record<string, LiveQuote>>({});
  const tickerKey = openTickers.join(",");

  useEffect(() => {
    setLive((prev) => {
      const next = { ...prev };
      openTickers.forEach((tk) => {
        if (!next[tk]) {
          const t = trades.find((x) => x.ticker === tk);
          next[tk] = { price: t?.stockPriceOpen ?? 0, dir: 0 };
        }
      });
      return next;
    });

    let cancelled = false;

    async function poll() {
      const updates: Record<string, LiveQuote> = {};
      await Promise.all(
        openTickers.map(async (tk) => {
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
    // tickerKey is the stable identity of the open-symbol set
  }, [tickerKey, openTickers, trades]);

  return live;
}
