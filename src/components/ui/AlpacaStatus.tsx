"use client";

import { RefreshCw } from "lucide-react";
import { useAlpacaConnection } from "@/components/alpaca/AlpacaConnectionProvider";
import { useMarketSession } from "@/hooks/useMarketSession";
import { useLiveMarket } from "@/hooks/useLiveMarket";

export function AlpacaStatus({ compact = false }: { compact?: boolean }) {
  const { state, checkConnection } = useAlpacaConnection();
  const { schedule } = useMarketSession();
  const { lastQuoteAt, lastMarkAt } = useLiveMarket();

  const appearance =
    state === "checking"
      ? "checking"
      : state === "offline"
        ? "offline"
        : state === "simulated"
          ? "simulated"
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
    simulated: "border-otto-amber/35 bg-otto-amber-soft text-otto-amber",
    offline: "border-otto-red/35 bg-otto-red-soft text-otto-red",
  }[appearance];
  const label = {
    checking: "Checking Otto",
    live: "Otto live",
    delayed: "Otto delayed",
    asOfClose: "As of close",
    simulated: "Otto simulated",
    offline: "Otto offline",
  }[appearance];

  const asOf = lastMarkAt ?? lastQuoteAt;
  const title =
    appearance === "asOfClose"
      ? asOf
        ? `Last market data ${new Date(asOf).toLocaleString()}`
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
              : appearance === "delayed" || appearance === "simulated"
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
