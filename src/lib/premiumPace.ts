import { isDebitStrategy, type Trade } from "@/types/trade";
import { premiumDirection, todayISO } from "@/lib/pnl";
import type { PositionRiskThresholds } from "@/types/notification";

export const DEFAULT_POSITION_RISK_THRESHOLDS: PositionRiskThresholds = {
  criticalStrikeDistancePct: 5,
  watchStrikeDistancePct: 15,
  watchTimeUsedPct: 75,
  underwaterPremiumLossPct: 50,
};

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

/** Signed distance to the nearest sold strike: positive OTM, negative ITM. */
export function shortStrikeDistancePct(
  trade: Trade,
  spot: number | null | undefined
) {
  if (!spot || spot <= 0) return null;
  const distances: number[] = [];
  const putSide =
    trade.strategy === "Put Credit Spread" ||
    trade.strategy === "Cash-Secured Put" ||
    trade.strategy === "Iron Condor" ||
    trade.strategy === "Strangle";
  const callSide =
    trade.strategy === "Call Credit Spread" ||
    trade.strategy === "Covered Call" ||
    trade.strategy === "Iron Condor" ||
    trade.strategy === "Strangle";

  if (putSide && trade.shortStrike && trade.shortStrike > 0) {
    distances.push(((spot - trade.shortStrike) / trade.shortStrike) * 100);
  }
  const callStrike =
    trade.strategy === "Iron Condor"
      ? trade.callShortStrike
      : callSide
        ? trade.shortStrike
        : null;
  if (callSide && callStrike && callStrike > 0) {
    distances.push(((callStrike - spot) / callStrike) * 100);
  }
  return distances.length ? Math.min(...distances) : null;
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
  options: {
    now?: string;
    spot?: number;
    thresholds?: PositionRiskThresholds;
  } = {}
): PositionAlert | null {
  if (trade.status !== "open") return null;
  const durationDays = calendarDays(trade.openDate, trade.expiry);
  if (durationDays <= 0) return null;

  const now = options.now ?? todayISO();
  const thresholds =
    options.thresholds ?? DEFAULT_POSITION_RISK_THRESHOLDS;
  const elapsedDays = Math.max(0, calendarDays(trade.openDate, now));
  const days = dayContext(elapsedDays, durationDays);
  const strikeDistance = shortStrikeDistancePct(trade, options.spot);
  if (
    strikeDistance != null &&
    strikeDistance <= thresholds.criticalStrikeDistancePct
  ) {
    return {
      tone: "negative",
      tier: "critical",
      label: "Critical",
      capturePct: 0,
      elapsedDays,
      durationDays,
      detail: `${distanceLabel(strikeDistance)} to short strike · ${days}`,
    };
  }
  if (
    typeof currentMark !== "number" ||
    !Number.isFinite(currentMark) ||
    !trade.premiumOpen
  ) {
    if (
      strikeDistance != null &&
      strikeDistance <= thresholds.watchStrikeDistancePct
    ) {
      return {
        tone: "negative",
        tier: "watch",
        label: "Watch",
        capturePct: 0,
        elapsedDays,
        durationDays,
        detail: `${distanceLabel(strikeDistance)} to short strike · ${days}`,
      };
    }
    return null;
  }
  const timeUsed = elapsedDays / durationDays;
  const openPremium = Math.abs(trade.premiumOpen);
  const debit = isDebitStrategy(trade.strategy);
  // Credit positions gain as the premium decays; debit positions as it grows.
  const capture =
    (premiumDirection(trade.strategy) * (openPremium - Math.abs(currentMark))) / openPremium;
  const capturePct = Math.round(capture * 100);
  const remaining = Math.max(0, durationDays - elapsedDays);
  const basis = debit ? "premium paid" : "premium";
  const gained = debit ? "Up" : "Captured";
  if (capture <= -1 || (capture < 0 && timeUsed >= 0.85)) {
    return {
      tone: "negative",
      tier: "critical",
      label: "Critical",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Down ${Math.abs(capturePct)}% of ${basis} · ${days}`,
    };
  }
  if (capture <= -(thresholds.underwaterPremiumLossPct / 100)) {
    return {
      tone: "negative",
      tier: "underwater",
      label: "Underwater",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `Down ${Math.abs(capturePct)}% of ${basis} · ${days}`,
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
      detail: `Unrealized loss of ${Math.abs(capturePct)}% of ${basis} · ${days}`,
    };
  }
  if (
    strikeDistance != null &&
    strikeDistance <= thresholds.watchStrikeDistancePct
  ) {
    return {
      tone: "negative",
      tier: "watch",
      label: "Watch",
      capturePct,
      elapsedDays,
      durationDays,
      detail: `${distanceLabel(strikeDistance)} to short strike · ${days}`,
    };
  }
  if (
    timeUsed >= thresholds.watchTimeUsedPct / 100 &&
    capture < 0.25
  ) {
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

  // A bought option has no capped profit, so "Near max" only fits credit trades.
  if (!debit && capture >= 0.9) {
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
      detail: `${gained} ${capturePct}% of ${basis} in ${days}`,
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
      detail: `${gained} ${capturePct}% of ${basis} in ${days}`,
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
      detail: `${gained} ${capturePct}% of ${basis} in ${days}`,
    };
  }
  return null;
}

function distanceLabel(distance: number) {
  if (Math.abs(distance) < 0.05) return "At the short strike";
  return `${Math.abs(distance).toFixed(1)}% ${distance >= 0 ? "OTM" : "ITM"}`;
}
