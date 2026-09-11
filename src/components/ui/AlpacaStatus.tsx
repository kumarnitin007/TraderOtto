"use client";

import { RefreshCw } from "lucide-react";
import { useAlpacaConnection } from "@/components/alpaca/AlpacaConnectionProvider";
import { useMarketSession } from "@/hooks/useMarketSession";
import { useLiveMarket } from "@/hooks/useLiveMarket";

function formatAsOf(iso: string, compact: boolean) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(compact ? {} : { weekday: "short" }),
  });
}

export function AlpacaStatus({ compact = false }: { compact?: boolean }) {
  const { state, checkConnection } = useAlpacaConnection();
  const { schedule } = useMarketSession();
  const { snapshotAt, dataSource, lastQuoteAt, lastMarkAt } = useLiveMarket();
  const asOf = snapshotAt ?? lastMarkAt ?? lastQuoteAt;
  const stale = dataSource === "cache" || (state === "offline" && Boolean(asOf));

  const appearance =
    state === "checking"
      ? "checking"
      : state === "simulated" || dataSource === "simulated"
        ? "simulated"
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
    simulated: "border-otto-amber/35 bg-otto-amber-soft text-otto-amber",
    offline: "border-otto-red/35 bg-otto-red-soft text-otto-red",
  }[appearance];

  const label =
    appearance === "checking"
      ? "Checking Otto"
      : appearance === "simulated"
        ? "Otto simulated"
        : appearance === "offline"
          ? "Otto offline"
          : appearance === "cached" && asOf
            ? `As of ${formatAsOf(asOf, compact)}`
            : appearance === "asOfClose"
              ? asOf
                ? `As of ${formatAsOf(asOf, compact)}`
                : "As of close"
              : appearance === "delayed"
                ? "Otto delayed"
                : "Otto live";

  const title =
    appearance === "cached"
      ? asOf
        ? `Showing last saved market data from ${new Date(asOf).toLocaleString()}`
        : "Showing last saved market data"
      : appearance === "asOfClose"
        ? asOf
          ? `Market closed — last data ${new Date(asOf).toLocaleString()}`
          : "Market closed — showing last available prices"
        : appearance === "delayed"
          ? "Extended hours — stock quotes only, option marks paused"
          : "Refresh market-data connection";

  return (
    <button
      type="button"
      onClick={() => void checkConnection()}
      className={`flex items-center gap-1.5 rounded-full border font-semibold transition-colors ${styles} ${
        compact ? "mt-0 h-7 px-2 text-[10.5px]" : "mt-[22px] px-3 py-2 text-xs"
      }`}
      title={title}
    >
      {state === "checking" ? (
        <RefreshCw size={11} className="otto-spin" />
      ) : (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            appearance === "live"
              ? "otto-pulse bg-otto-green"
              : appearance === "delayed" || appearance === "simulated" || appearance === "cached"
                ? "bg-otto-amber"
                : appearance === "offline"
                  ? "bg-otto-red"
                  : "bg-otto-text-faint"
          }`}
        />
      )}
      {label}
    </button>
  );
}
