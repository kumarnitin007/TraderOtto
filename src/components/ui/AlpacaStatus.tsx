"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useAlpacaConnection } from "@/components/alpaca/AlpacaConnectionProvider";
import { useMarketSession } from "@/hooks/useMarketSession";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { easternParts, type MarketSchedule } from "@/lib/marketSession";

type Appearance = "checking" | "live" | "delayed" | "asOfClose" | "cached" | "offline";

const STATUS_ROWS: {
  id: Exclude<Appearance, "checking">;
  name: string;
  when: string;
}[] = [
  {
    id: "live",
    name: "Active",
    when: "Regular hours, 9:30–4:00 ET. Stocks and option marks refresh about every 30 seconds.",
  },
  {
    id: "delayed",
    name: "Delayed",
    when: "Pre-market and after hours. Stocks refresh about every 60 seconds. Option marks pause because those quotes are thin.",
  },
  {
    id: "asOfClose",
    name: "As of close",
    when: "Overnight, weekends, and holidays. No live polling — last session prices stay on screen.",
  },
  {
    id: "cached",
    name: "Last saved",
    when: "The live feed is unreachable. Otto shows the snapshot saved about every 3 hours, with its timestamp.",
  },
  {
    id: "offline",
    name: "Offline",
    when: "No live feed and no saved snapshot to fall back on.",
  },
];

function formatAsOf(iso: string, compact: boolean) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(compact ? {} : { weekday: "short" }),
  });
}

function formatEt(iso: string | null) {
  if (!iso) return null;
  return (
    new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }) + " ET"
  );
}

function statusBlurb(appearance: Appearance, schedule: MarketSchedule, nextOpen: string | null) {
  const nextActive = nextOpen
    ? `Will change to Active in regular open hours at ${nextOpen}.`
    : "Will change to Active at the next regular open.";
  if (appearance === "checking") return "Checking the market feed…";
  if (appearance === "live") return "Regular hours. Otto is Active.";
  if (appearance === "delayed") {
    const minutes = easternParts(new Date(schedule.clockAt)).minutes;
    const phase = minutes < 9 * 60 + 30 ? "Pre-market" : "After hours";
    return `${phase}. ${nextActive}`;
  }
  if (appearance === "asOfClose") return `The market is closed. ${nextActive}`;
  if (appearance === "cached") return `Showing the snapshot stored in Otto. ${nextActive}`;
  return "No live feed. Fetch latest data to retry.";
}

function appearanceDot(appearance: Appearance) {
  return appearance === "live"
    ? "otto-pulse bg-otto-green"
    : appearance === "delayed" || appearance === "cached"
      ? "bg-otto-amber"
      : appearance === "offline"
        ? "bg-otto-red"
        : "bg-otto-text-faint";
}

export function AlpacaStatus({ compact = false }: { compact?: boolean }) {
  const { state, checkConnection } = useAlpacaConnection();
  const { schedule } = useMarketSession();
  const { snapshotAt, savedAt, dataSource, lastQuoteAt, lastMarkAt, refreshing, refreshNow } =
    useLiveMarket();
  const [open, setOpen] = useState(false);
  const asOf = snapshotAt ?? lastMarkAt ?? lastQuoteAt;
  const lastSavedLabel = savedAt ? formatAsOf(savedAt, compact) : null;
  const stale = dataSource === "cache" || (state === "offline" && Boolean(asOf));

  const appearance: Appearance =
    state === "checking"
      ? "checking"
      : stale
        ? "cached"
        : state === "offline"
          ? "offline"
          : schedule.asOfClose
            ? "asOfClose"
            : schedule.delayed
              ? "delayed"
              : "live";

  const styles = {
    checking: "border-otto-divider bg-otto-surface text-otto-text-faint",
    live: "border-otto-green/35 bg-otto-green-soft text-otto-green",
    delayed: "border-otto-amber/35 bg-otto-amber-soft text-otto-amber",
    asOfClose: "border-otto-divider bg-otto-surface text-otto-text-dim",
    cached: "border-otto-amber/35 bg-otto-amber-soft text-otto-amber",
    offline: "border-otto-red/35 bg-otto-red-soft text-otto-red",
  }[appearance];

  const label =
    appearance === "checking"
      ? "Checking Otto"
      : appearance === "offline"
        ? "Otto offline"
        : appearance === "cached" && lastSavedLabel
          ? `As of ${lastSavedLabel}`
          : appearance === "asOfClose"
            ? asOf
              ? `As of ${formatAsOf(asOf, compact)}`
              : "As of close"
            : appearance === "delayed"
              ? "Otto delayed"
              : "Otto active";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nextOpen = formatEt(schedule.nextOpen);
  const currentName =
    STATUS_ROWS.find((row) => row.id === appearance)?.name ?? "Checking";

  async function fetchLatest() {
    await refreshNow();
    await checkConnection({ quiet: true });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-full border font-semibold transition-colors ${styles} ${
          compact ? "mt-0 h-7 px-2 text-[10.5px]" : "mt-[22px] px-3 py-2 text-xs"
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Otto status — tap for Active, Delayed, and other modes"
      >
        {state === "checking" ? (
          <RefreshCw size={11} className="otto-spin" />
        ) : (
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${appearanceDot(appearance)}`} />
        )}
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 desk:items-center">
          <button
            type="button"
            aria-label="Close Otto status"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/65"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="otto-status-title"
            className="relative z-10 w-full max-w-[420px] rounded-2xl border border-otto-divider bg-otto-bg p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div id="otto-status-title" className="text-[15px] font-extrabold">
                  Otto Status — {currentName}
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-otto-text-dim">
                  {statusBlurb(appearance, schedule, nextOpen)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-otto-surface text-otto-text-dim"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <ul className="mt-3.5 space-y-1.5">
              {STATUS_ROWS.map((row) => {
                const current = row.id === appearance;
                return (
                  <li
                    key={row.id}
                    className={`rounded-xl px-3 py-2.5 ${
                      current ? "bg-otto-surface ring-1 ring-otto-divider" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${appearanceDot(row.id)}`} />
                      <span className="text-[13px] font-bold">{row.name}</span>
                      {row.id === "cached" && savedAt && (
                        <span className="text-[11px] font-semibold text-otto-text-faint">
                          {formatAsOf(savedAt, false)}
                        </span>
                      )}
                      {current && (
                        <span className="rounded-full bg-otto-green-soft px-1.5 py-0.5 text-[10px] font-bold text-otto-green">
                          Now
                        </span>
                      )}
                    </div>
                    <p className="mt-1 pl-3.5 text-[11.5px] leading-snug text-otto-text-faint">
                      {row.id === "cached"
                        ? savedAt
                          ? "Snapshot stored in Otto. Fetch latest overwrites it when the new data is newer."
                          : "Nothing stored yet. Fetch latest data to save a snapshot."
                        : row.when}
                    </p>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={() => void fetchLatest()}
              disabled={refreshing}
              className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-otto-green py-2.5 text-[12.5px] font-bold text-black disabled:opacity-70"
            >
              <RefreshCw size={13} className={refreshing ? "otto-spin" : ""} />
              {refreshing ? "Fetching latest…" : "Fetch latest data"}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-otto-text-faint">
              Pulls current quotes and marks, and saves them to Otto if they are newer than the last snapshot.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
