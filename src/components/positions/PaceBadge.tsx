"use client";

import type { AlertTier, PositionAlert } from "@/lib/premiumPace";

const TIER_CLASS: Record<AlertTier, string> = {
  nearmax: "bg-otto-green-soft text-otto-green",
  exceptional: "bg-otto-amber-soft text-otto-amber",
  strong: "bg-otto-green-soft text-otto-green",
  ahead: "border border-otto-divider text-otto-text-dim",
  watch: "bg-otto-amber-soft text-otto-amber",
  underwater: "bg-otto-red-soft text-otto-red",
  critical: "border border-otto-red bg-otto-red-soft text-otto-red",
};

export function PaceBadge({
  signal,
  alertHref,
}: {
  signal: PositionAlert;
  alertHref?: string;
}) {
  return (
    <span
      data-alert-href={alertHref}
      title={`${signal.detail}${alertHref ? " · Open related alerts" : ""}`}
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.01em] ${
        alertHref ? "cursor-pointer underline decoration-transparent hover:decoration-current" : ""
      } ${TIER_CLASS[signal.tier]}`}
    >
      {signal.label}
    </span>
  );
}
