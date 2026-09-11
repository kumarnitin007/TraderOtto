"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Trade } from "@/types/trade";
import { serializeLegs, tradeOptionLegs } from "@/lib/optionLegs";
import { authHeaders } from "@/lib/authHeaders";
import { useMarketSession } from "@/hooks/useMarketSession";
import { useTrades } from "@/hooks/useTrades";
import { useWatchGroups } from "@/hooks/useWatchGroups";

type LiveQuote = { price: number; dir: -1 | 0 | 1 };
type OptionMark = {
  mark: number;
  ts?: string;
  iv?: number;
  delta?: number;
  theta?: number;
  vega?: number;
};

type LiveMarketValue = {
  quotes: Record<string, LiveQuote>;
  marks: Record<string, OptionMark>;
  lastQuoteAt: string | null;
  lastMarkAt: string | null;
  snapshotAt: string | null;
  savedAt: string | null;
  dataSource: "live" | "cache" | null;
  refreshing: boolean;
  refreshNow: () => Promise<void>;
};

function laterIso(current: string | null, next?: string | null) {
  if (!next) return current;
  if (!current) return next;
  return Date.parse(next) >= Date.parse(current) ? next : current;
}

const LiveMarketContext = createContext<LiveMarketValue | null>(null);

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export function LiveMarketProvider({ children }: { children: ReactNode }) {
  const { trades } = useTrades();
  const { groups } = useWatchGroups();
  const { schedule, visible } = useMarketSession();
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [marks, setMarks] = useState<Record<string, OptionMark>>({});
  const [lastQuoteAt, setLastQuoteAt] = useState<string | null>(null);
  const [lastMarkAt, setLastMarkAt] = useState<string | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "cache" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;

  const symbols = useMemo(() => {
    const set = new Set<string>();
    for (const trade of trades) {
      if (trade.status === "open") set.add(trade.ticker.toUpperCase());
    }
    for (const group of groups) {
      for (const tracker of group.trackers) set.add(tracker.ticker.toUpperCase());
    }
    return Array.from(set).sort();
  }, [trades, groups]);

  const optionJobs = useMemo(
    () =>
      trades
        .filter((trade) => trade.status === "open" && trade.expiry)
        .map((trade) => ({ trade, legs: tradeOptionLegs(trade) }))
        .filter((entry): entry is { trade: Trade; legs: NonNullable<typeof entry.legs> } =>
          entry.legs != null
        ),
    [trades]
  );

  const tickerKey = symbols.join(",");
  const tradeKey = optionJobs
    .map(({ trade, legs }) => `${trade.id}:${trade.ticker}:${trade.expiry}:${serializeLegs(legs)}`)
    .join("|");
  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  const optionJobsRef = useRef(optionJobs);
  optionJobsRef.current = optionJobs;

  const loadQuotes = useCallback(async (signal?: AbortSignal, persist = false) => {
    const list = symbolsRef.current;
    if (!list.length || signal?.aborted) return;
    const persistQuery = persist ? "&persist=1" : "";
    const response = await fetch(
      `/api/quotes?symbols=${encodeURIComponent(list.join(","))}${persistQuery}`,
      {
        cache: "no-store",
        signal,
        headers: await authHeaders(),
      }
    );
    if (!response.ok || signal?.aborted) return;
    const data = (await response.json()) as {
      quotes?: Record<string, { price?: number; ts?: string }>;
      source?: string;
      fetchedAt?: string;
      savedAt?: string | null;
    };
    const updates: Record<string, LiveQuote> = {};
    for (const [symbol, quote] of Object.entries(data.quotes ?? {})) {
      if (typeof quote.price !== "number") continue;
      const prevPrice = quotesRef.current[symbol]?.price;
      updates[symbol] = {
        price: quote.price,
        dir: prevPrice == null ? 0 : quote.price >= prevPrice ? 1 : -1,
      };
    }
    if (!Object.keys(updates).length || signal?.aborted) return;
    setQuotes((prev) => ({ ...prev, ...updates }));
    const at = data.fetchedAt ?? new Date().toISOString();
    setLastQuoteAt(at);
    setSavedAt((current) => laterIso(current, data.savedAt));
    if (data.source === "cache") {
      setDataSource("cache");
      setSnapshotAt(at);
    } else {
      setDataSource("live");
      setSnapshotAt(at);
    }
  }, []);

  const loadMarks = useCallback(async (signal?: AbortSignal, persist = false) => {
    const jobs = optionJobsRef.current;
    if (!jobs.length || signal?.aborted) return;
    const response = await fetch("/api/option-spreads", {
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({
        persist,
        positions: jobs.map(({ trade, legs }) => ({
          id: trade.id,
          symbol: trade.ticker,
          expiry: trade.expiry,
          legs: serializeLegs(legs),
        })),
      }),
    });
    if (!response.ok || signal?.aborted) return;
    const data = (await response.json()) as {
      marks?: Record<string, OptionMark>;
      source?: string;
      fetchedAt?: string;
      savedAt?: string | null;
    };
    const updates = data.marks ?? {};
    if (!Object.keys(updates).length || signal?.aborted) return;
    setMarks((prev) => ({ ...prev, ...updates }));
    const at = data.fetchedAt ?? new Date().toISOString();
    setLastMarkAt(at);
    setSavedAt((current) => laterIso(current, data.savedAt));
    if (data.source === "cache") {
      setDataSource("cache");
      setSnapshotAt(at);
    } else {
      setDataSource((current) => (current === "cache" ? current : "live"));
      setSnapshotAt(at);
    }
  }, []);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    try {
      // Sequential so quotes land in the snapshot before marks merge on top.
      await loadQuotes(undefined, true);
      await loadMarks(undefined, true);
    } catch {
      /* keep last quotes and marks */
    } finally {
      setRefreshing(false);
    }
  }, [loadQuotes, loadMarks]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();

    async function loop() {
      try {
        await loadQuotes(controller.signal);
      } catch {
        /* keep last quotes */
      }
      while (!controller.signal.aborted && schedule.pollStocks) {
        await delay(schedule.stockIntervalMs, controller.signal);
        if (controller.signal.aborted || !schedule.pollStocks) break;
        try {
          await loadQuotes(controller.signal);
        } catch {
          /* keep last quotes */
        }
      }
    }

    void loop();
    return () => controller.abort();
  }, [visible, tickerKey, loadQuotes, schedule.pollStocks, schedule.stockIntervalMs, schedule.session]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();

    async function loop() {
      try {
        await loadMarks(controller.signal);
      } catch {
        /* keep last marks */
      }
      while (!controller.signal.aborted && schedule.pollOptions) {
        await delay(schedule.optionIntervalMs, controller.signal);
        if (controller.signal.aborted || !schedule.pollOptions) break;
        try {
          await loadMarks(controller.signal);
        } catch {
          /* keep last marks */
        }
      }
    }

    void loop();
    return () => controller.abort();
  }, [visible, tradeKey, loadMarks, schedule.pollOptions, schedule.optionIntervalMs, schedule.session]);

  const value = useMemo(
    () => ({
      quotes,
      marks,
      lastQuoteAt,
      lastMarkAt,
      snapshotAt,
      savedAt,
      dataSource,
      refreshing,
      refreshNow,
    }),
    [quotes, marks, lastQuoteAt, lastMarkAt, snapshotAt, savedAt, dataSource, refreshing, refreshNow]
  );

  return <LiveMarketContext.Provider value={value}>{children}</LiveMarketContext.Provider>;
}

export function useLiveMarket() {
  const context = useContext(LiveMarketContext);
  if (!context) {
    throw new Error("useLiveMarket must be used within LiveMarketProvider");
  }
  return context;
}
