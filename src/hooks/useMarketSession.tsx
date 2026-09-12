"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clockRefreshMs,
  resolveSchedule,
  type MarketSchedule,
} from "@/lib/marketSession";

const FALLBACK: MarketSchedule = resolveSchedule(new Date(), null);

type MarketSessionValue = {
  schedule: MarketSchedule;
  visible: boolean;
  refresh: () => Promise<MarketSchedule>;
};

const MarketSessionContext = createContext<MarketSessionValue | null>(null);

function pageVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function MarketSessionProvider({ children }: { children: ReactNode }) {
  const [schedule, setSchedule] = useState<MarketSchedule>(FALLBACK);
  const [visible, setVisible] = useState(true);

  const refresh = useCallback(async () => {
    let next = resolveSchedule(new Date(), null);
    try {
      const response = await fetch("/api/quotes?clock=1", { cache: "no-store" });
      if (response.ok) next = (await response.json()) as MarketSchedule;
    } catch {
      /* local weekend/hours fallback already in `next` */
    }
    setSchedule(next);
    return next;
  }, []);

  useEffect(() => {
    const onVis = () => setVisible(pageVisible());
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let timer = 0;

    async function tick() {
      const next = await refresh();
      if (cancelled) return;
      timer = window.setTimeout(() => void tick(), clockRefreshMs(next));
    }

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [visible, refresh]);

  const value = useMemo(() => ({ schedule, visible, refresh }), [schedule, visible, refresh]);

  return (
    <MarketSessionContext.Provider value={value}>{children}</MarketSessionContext.Provider>
  );
}

export function useMarketSession() {
  const context = useContext(MarketSessionContext);
  if (!context) {
    throw new Error("useMarketSession must be used within MarketSessionProvider");
  }
  return context;
}
