"use client";

import { RefreshCw } from "lucide-react";
import { useAlpacaConnection } from "@/components/alpaca/AlpacaConnectionProvider";

export function AlpacaStatus({ compact = false }: { compact?: boolean }) {
  const { state, checkConnection } = useAlpacaConnection();

  const styles = {
    checking: "border-otto-divider bg-otto-surface text-otto-text-faint",
    live: "border-otto-green/35 bg-otto-green-soft text-otto-green",
    simulated: "border-otto-amber/35 bg-otto-amber-soft text-otto-amber",
    offline: "border-otto-red/35 bg-otto-red-soft text-otto-red",
  }[state];
  const label = {
    checking: "Checking Alpaca",
    live: "Alpaca live",
    simulated: "Alpaca simulated",
    offline: "Alpaca offline",
  }[state];

  return (
    <button
      type="button"
      onClick={() => void checkConnection()}
      className={`flex items-center gap-1.5 rounded-full border font-semibold transition-colors ${styles} ${
        compact ? "mt-0 h-7 px-2 text-[10.5px]" : "mt-[22px] px-3 py-2 text-xs"
      }`}
      title="Refresh Alpaca market-data connection"
    >
      {state === "checking" ? (
        <RefreshCw size={11} className="otto-spin" />
      ) : (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            state === "live"
              ? "otto-pulse bg-otto-green"
              : state === "simulated"
                ? "bg-otto-amber"
                : "bg-otto-red"
          }`}
        />
      )}
      {label}
    </button>
  );
}
