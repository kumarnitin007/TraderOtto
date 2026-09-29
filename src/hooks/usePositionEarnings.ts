"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { earningsCacheNeedsRefresh } from "@/lib/earningsCache";
import { createTickerEarningsRepository, type TickerEarnings } from "@/lib/data/tickerEarningsRepository";
import { todayISO } from "@/lib/pnl";
import { getSupabaseClient } from "@/lib/supabase";
import type { Trade } from "@/types/trade";

const inflight = new Set<string>();

export function usePositionEarnings(trades: Trade[]) {
  const { user } = useAuth();
  const { groups, updateTracker, readonly: groupsReadonly } = useWatchGroups();
  const [stored, setStored] = useState<Record<string, TickerEarnings>>({});
  const [loaded, setLoaded] = useState(false);
  const readonly = !user || user.id === "local-bypass" || groupsReadonly;
  const openTickers = useMemo(
    () =>
      Array.from(
        new Set(
          trades
            .filter((trade) => trade.status === "open")
            .map((trade) => trade.ticker.toUpperCase())
        )
      ).sort(),
    [trades]
  );
  const tickerKey = openTickers.join(",");

  const fromLists = useMemo(() => {
    const next: Record<string, TickerEarnings> = {};
    for (const group of groups) {
      for (const tracker of group.trackers) {
        const ticker = tracker.ticker.toUpperCase();
        if (!openTickers.includes(ticker)) continue;
        const current = next[ticker];
        if (
          !current ||
          (tracker.earningsCheckedAt ?? "") > (current.earningsCheckedAt ?? "")
        ) {
          next[ticker] = {
            ticker,
            earningsDate: tracker.earningsDate,
            earningsTiming: tracker.earningsTiming,
            earningsCheckedAt: tracker.earningsCheckedAt,
          };
        }
      }
    }
    return next;
  }, [groups, openTickers]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !user || readonly || !openTickers.length) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    const repository = createTickerEarningsRepository(supabase, user.id);
    repository
      .list(openTickers)
      .then((rows) => {
        if (cancelled) return;
        setStored(Object.fromEntries(rows.map((row) => [row.ticker, row])));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [openTickers, readonly, tickerKey, user]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !user || readonly || !loaded) return;
    let cancelled = false;
    const repository = createTickerEarningsRepository(supabase, user.id);

    async function refresh() {
      for (const ticker of openTickers) {
        const saved = stored[ticker];
        const listed = fromLists[ticker];
        const freshest =
          (saved?.earningsCheckedAt ?? "") >= (listed?.earningsCheckedAt ?? "")
            ? saved
            : listed;
        if (
          freshest &&
          !earningsCacheNeedsRefresh({
            earningsDate: freshest.earningsDate,
            earningsCheckedAt: freshest.earningsCheckedAt,
          })
        ) {
          continue;
        }
        if (inflight.has(ticker)) continue;
        inflight.add(ticker);
        try {
          const response = await fetch(
            `/api/ticker/${encodeURIComponent(ticker)}?lite=earnings`,
            { cache: "no-store" }
          );
          if (!response.ok || cancelled) continue;
          const data = (await response.json()) as {
            date?: string | null;
            timing?: string | null;
          };
          const next: TickerEarnings = {
            ticker,
            earningsDate: data.date ?? null,
            earningsTiming: data.timing ?? null,
            earningsCheckedAt: todayISO(),
          };
          await repository.save(ticker, next);
          if (cancelled) return;
          setStored((current) => ({ ...current, [ticker]: next }));
          for (const group of groups) {
            for (const tracker of group.trackers) {
              if (tracker.ticker.toUpperCase() !== ticker) continue;
              updateTracker(group.id, tracker.id, {
                earningsDate: next.earningsDate,
                earningsTiming: next.earningsTiming,
                earningsCheckedAt: next.earningsCheckedAt,
              });
            }
          }
        } catch {
          /* Keep the last saved date. */
        } finally {
          inflight.delete(ticker);
        }
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [fromLists, groups, loaded, openTickers, readonly, stored, tickerKey, updateTracker, user]);

  return useMemo(() => {
    const merged: Record<string, TickerEarnings> = { ...stored };
    for (const [ticker, listed] of Object.entries(fromLists)) {
      const current = merged[ticker];
      if (!current || (listed.earningsCheckedAt ?? "") > (current.earningsCheckedAt ?? "")) {
        merged[ticker] = listed;
      }
    }
    return merged;
  }, [fromLists, stored]);
}
