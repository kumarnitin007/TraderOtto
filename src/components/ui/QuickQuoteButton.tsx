"use client";

import { useState } from "react";
import { RefreshCw, Zap } from "lucide-react";

export function QuickQuoteButton({
  ticker,
  onFill,
  size = "sm",
}: {
  ticker: string;
  onFill: (price: string) => void;
  size?: "sm" | "md";
}) {
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);

  async function go() {
    if (!ticker) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/quote/${encodeURIComponent(ticker)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const q = (await res.json()) as { price: number };
        onFill(q.price.toFixed(2));
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={loading || !ticker}
      className={`flex shrink-0 items-center gap-[5px] rounded-full border font-semibold transition-all duration-200 ${
        size === "sm" ? "px-[11px] py-[9px] text-[12.5px]" : "px-[14px] py-2.5 text-[12.5px]"
      } ${
        flash
          ? "border-otto-green bg-otto-green-soft text-otto-green"
          : "border-otto-divider bg-otto-surface text-otto-text"
      } ${ticker ? "opacity-100" : "opacity-40"}`}
    >
      {loading ? (
        <RefreshCw size={13} className="otto-spin" />
      ) : (
        <Zap size={13} strokeWidth={2.4} />
      )}
      {loading ? "Fetching" : "Live price"}
    </button>
  );
}
