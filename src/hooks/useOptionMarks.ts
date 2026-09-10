"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trade } from "@/types/trade";
import { serializeLegs, tradeOptionLegs } from "@/lib/optionLegs";

export type OptionMark = {
  mark: number;
  ts?: string;
  iv?: number;
  delta?: number;
  theta?: number;
  vega?: number;
};

export function useOptionMarks(trades: Trade[]) {
  const eligible = useMemo(
    () =>
      trades
        .filter((trade) => trade.status === "open" && trade.expiry)
        .map((trade) => ({ trade, legs: tradeOptionLegs(trade) }))
        .filter((entry): entry is { trade: Trade; legs: NonNullable<typeof entry.legs> } =>
          entry.legs != null
        ),
    [trades]
  );
  const tradeKey = eligible
    .map(({ trade, legs }) => `${trade.id}:${trade.ticker}:${trade.expiry}:${serializeLegs(legs)}`)
    .join("|");
  const [marks, setMarks] = useState<Record<string, OptionMark>>({});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const results = await Promise.all(
        eligible.map(async ({ trade, legs }) => {
          const query = new URLSearchParams({
            symbol: trade.ticker,
            expiry: trade.expiry,
            legs: serializeLegs(legs),
          });
          try {
            const response = await fetch(`/api/option-spread?${query}`, {
              cache: "no-store",
            });
            if (!response.ok) return null;
            const data = (await response.json()) as {
              mark?: number;
              ts?: string;
              iv?: number;
              delta?: number;
              theta?: number;
              vega?: number;
            };
            if (typeof data.mark !== "number") return null;
            return [
              trade.id,
              {
                mark: data.mark,
                ts: data.ts,
                iv: data.iv,
                delta: data.delta,
                theta: data.theta,
                vega: data.vega,
              },
            ] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      setMarks((previous) => {
        const next = { ...previous };
        for (const result of results) {
          if (result) next[result[0]] = result[1];
        }
        return next;
      });
    }

    void poll();
    const interval = window.setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tradeKey, eligible]);

  return marks;
}
