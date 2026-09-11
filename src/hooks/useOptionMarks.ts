"use client";

import { useMemo } from "react";
import type { Trade } from "@/types/trade";
import { useLiveMarket } from "@/hooks/useLiveMarket";

export type OptionMark = {
  mark: number;
  ts?: string;
  iv?: number;
  delta?: number;
  theta?: number;
  vega?: number;
};

export function useOptionMarks(trades: Trade[]) {
  const { marks } = useLiveMarket();
  const ids = useMemo(
    () =>
      trades
        .filter((trade) => trade.status === "open" && trade.expiry)
        .map((trade) => trade.id)
        .join("|"),
    [trades]
  );

  return useMemo(() => {
    if (!ids) return {};
    const next: Record<string, OptionMark> = {};
    for (const id of ids.split("|")) {
      if (marks[id]) next[id] = marks[id];
    }
    return next;
  }, [ids, marks]);
}
