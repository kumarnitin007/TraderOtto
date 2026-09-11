import type { Trade } from "@/types/trade";
import { todayISO } from "@/lib/pnl";

export type AlertTier =
  | "nearmax"
  | "exceptional"
  | "strong"
  | "ahead"
  | "watch"
  | "underwater"
  | "critical";

export type PositionAlert = {
  tone: "positive" | "negative";
  tier: AlertTier;
  label:
    | "Near max"
    | "Exceptional"
    | "Strong"
    | "Ahead"
    | "Watch"
    | "Underwater"
    | "Critical";
  capturePct: number;
  elapsedDays: number;
  durationDays: number;
  detail: string;
};

function calendarDays(from: string, to: string) {
  const start = new Date(from + "T00:00:00").getTime();
  const end = new Date(to + "T00:00:00").getTime();
  return Math.round((end - start) / 86_400_000);
}

function dayContext(elapsedDays: number, durationDays: number) {
  return `${elapsedDays} of ${durationDays} days`;
}

/**
 * One badge for an open position: either ahead of schedule or under pressure.
 * Risk (checked first): Critical ≤ −100% of premium, or still losing in the last ~15% of days;
 * Underwater ≤ −50%; Watch = any loss, or <25% captured in the last 25% of the duration.
 * Pace: Near max ≥90% of premium at any time; Exceptional ≥50% in first 25% of days;
 * Strong ≥50% in first 50%; Ahead ≥75% with ≥25% time left.
 */
export function positionAlert(
  trade: Trade,
  currentMark: number | undefined,
  now = todayISO()
): PositionAlert | null {
  if (trade.status !== "open") return null;
  if (typeof currentMark !== "number" || !Number.isFinite(currentMark)) return null;
  if (!trade.premiumOpen) return null;

  const durationDays = calendarDays(trade.openDate, trade.expiry);
  if (durationDays <= 0) return null;

  const elapsedDays = Math.max(0, calendarDays(trade.openDate, now));
  const timeUsed = elapsedDays / durationDays;
  const capture = (trade.premiumOpen - currentMark) / Math.abs(trade.premiumOpen);
  const capturePct = Math.round(capture * 100);
  const days = dayContext(elapsedDays, durationDays);
  const remaining = Math.max(0, durationDays - elapsedDays);

  if (capture <= -1 || (capture < 0 && timeUsed >= 0.85)) {
    return {
      tone: "negative",
      tier: "critical",
      label: "Critical",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Down ${Math.abs(capturePct)}% of premium · ${days}`,
    };
  }
  if (capture <= -0.5) {
    return {
      tone: "negative",
      tier: "underwater",
      label: "Underwater",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Down ${Math.abs(capturePct)}% of premium · ${days}`,
    };
  }
  if (capture < 0) {
    return {
      tone: "negative",
      tier: "watch",
      label: "Watch",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Unrealized loss of ${Math.abs(capturePct)}% of premium · ${days}`,
    };
  }
  if (timeUsed >= 0.75 && capture < 0.25) {
    return {
      tone: "negative",
      tier: "watch",
      label: "Watch",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Only ${capturePct}% captured with ${remaining} day${remaining === 1 ? "" : "s"} to expiry`,
    };
  }

  if (capture >= 0.9) {
    return {
      tone: "positive",
      tier: "nearmax",
      label: "Near max",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Captured ${capturePct}% of premium · ${days}`,
    };
  }
  if (capture >= 0.5 && timeUsed <= 0.25) {
    return {
      tone: "positive",
      tier: "exceptional",
      label: "Exceptional",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Captured ${capturePct}% of premium in ${days}`,
    };
  }
  if (capture >= 0.5 && timeUsed <= 0.5) {
    return {
      tone: "positive",
      tier: "strong",
      label: "Strong",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Captured ${capturePct}% of premium in ${days}`,
    };
  }
  if (capture >= 0.75 && timeUsed <= 0.75) {
    return {
      tone: "positive",
      tier: "ahead",
      label: "Ahead",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Captured ${capturePct}% of premium in ${days}`,
    };
  }
  return null;
}
