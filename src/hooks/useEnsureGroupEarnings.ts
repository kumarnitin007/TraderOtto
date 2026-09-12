"use client";

import { useEffect, useRef } from "react";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { earningsNeedsRefresh, sectorNeedsRefresh } from "@/lib/earningsCache";
import { todayISO } from "@/lib/pnl";
import type { WatchGroup } from "@/types/watchGroup";

const inflight = new Set<string>();

export function useEnsureGroupEarnings(groups: WatchGroup[]) {
  const { updateTracker, readonly } = useWatchGroups();
  const groupsRef = useRef(groups);
  const updateRef = useRef(updateTracker);
  groupsRef.current = groups;
  updateRef.current = updateTracker;

  const signature = groups
    .map(
      (group) =>
        `${group.id}:${group.trackers
          .map(
            (tracker) =>
              `${tracker.id}:${tracker.earningsDate ?? ""}:${tracker.earningsCheckedAt ?? ""}:${tracker.sector ?? ""}`
          )
          .join(",")}`
    )
    .join("|");

  useEffect(() => {
    if (readonly) return;
    let cancelled = false;

    async function refresh() {
      for (const group of groupsRef.current) {
        for (const tracker of group.trackers) {
          if (earningsNeedsRefresh(tracker)) {
            const key = `${group.id}:${tracker.id}:earn`;
            if (!inflight.has(key)) {
              inflight.add(key);
              try {
                const response = await fetch(
                  `/api/ticker/${encodeURIComponent(tracker.ticker)}?lite=earnings`,
                  { cache: "no-store" }
                );
                if (!cancelled && response.ok) {
                  const data = (await response.json()) as {
                    date?: string | null;
                    timing?: string | null;
                  };
                  updateRef.current(group.id, tracker.id, {
                    earningsDate: data.date ?? null,
                    earningsTiming: data.timing ?? null,
                    earningsCheckedAt: todayISO(),
                  });
                }
              } catch {
                /* keep existing cache */
              } finally {
                inflight.delete(key);
              }
            }
          }

          if (cancelled) return;

          if (sectorNeedsRefresh(tracker)) {
            const key = `${group.id}:${tracker.id}:sector`;
            if (!inflight.has(key)) {
              inflight.add(key);
              try {
                const response = await fetch(
                  `/api/ticker/${encodeURIComponent(tracker.ticker)}?lite=industry`,
                  { cache: "no-store" }
                );
                if (!cancelled && response.ok) {
                  const data = (await response.json()) as { sector?: string | null };
                  updateRef.current(group.id, tracker.id, {
                    sector: data.sector ?? null,
                    sectorCheckedAt: todayISO(),
                  });
                }
              } catch {
                /* keep existing cache */
              } finally {
                inflight.delete(key);
              }
            }
          }
        }
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [readonly, signature]);
}
