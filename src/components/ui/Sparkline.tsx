"use client";

import { useMemo } from "react";
import { sparkPoints } from "@/lib/pnl";

export function Sparkline({
  ticker,
  base,
  positive,
}: {
  ticker: string;
  base: number;
  positive: boolean;
}) {
  const pts = useMemo(() => sparkPoints(ticker, base), [ticker, base]);
  const w = 60;
  const h = 22;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const path = pts
    .map((p, i) => `${(i / (pts.length - 1)) * w},${h - ((p - min) / range) * h}`)
    .join(" ");
  const color = positive ? "rgb(var(--otto-green))" : "rgb(var(--otto-red))";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
