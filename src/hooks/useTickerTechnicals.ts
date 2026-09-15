"use client";

import { useEffect, useMemo, useState } from "react";
import type { TickerTechnical } from "@/lib/alpacaServer";

export function useTickerTechnicals(tickers: string[]) {
  const key = useMemo(
    () =>
      Array.from(new Set(tickers.map((ticker) => ticker.toUpperCase())))
        .sort()
        .join(","),
    [tickers]
  );
  const [technicals, setTechnicals] = useState<Record<string, TickerTechnical>>(
    {}
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!key) {
      setTechnicals({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/quotes?analytics=1&symbols=${encodeURIComponent(key)}`,
      { cache: "no-store" }
    )
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (payload: {
          technicals?: Record<string, TickerTechnical>;
        } | null) => {
          if (!cancelled) setTechnicals(payload?.technicals ?? {});
        }
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { technicals, loading };
}
