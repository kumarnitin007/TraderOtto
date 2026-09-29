import { crossesEarnings } from "@/lib/earningsCache";
import { shortStrikeDistancePct } from "@/lib/premiumPace";
import { assignmentCapital, capitalUsed } from "@/lib/roi";
import { isDebitStrategy, type Trade } from "@/types/trade";

const DAY = 86_400_000;

export type RiskFactor = {
  id: string;
  label: string;
  detail: string;
  points: number;
  level: "high" | "medium" | "low" | "good";
};

export type TradeRiskReport = {
  score: number;
  level: "High" | "Elevated" | "Moderate" | "Low";
  factors: RiskFactor[];
  daysToExpiry: number;
  capitalAtRisk: number | null;
  assignmentExposure: number | null;
  maxProfit: number;
};

function daysBetween(from: string, to: string) {
  return Math.ceil(
    (new Date(`${to}T00:00:00`).getTime() -
      new Date(`${from}T00:00:00`).getTime()) /
      DAY
  );
}

function spreadWidth(trade: Trade) {
  const put =
    trade.shortStrike != null && trade.longStrike != null
      ? Math.abs(trade.shortStrike - trade.longStrike)
      : 0;
  const call =
    trade.callShortStrike != null && trade.callLongStrike != null
      ? Math.abs(trade.callShortStrike - trade.callLongStrike)
      : 0;
  return Math.max(put, call);
}

export function analyzeTradeRisk(
  trade: Trade,
  options: {
    today?: string;
    spot?: number | null;
    earningsDate?: string | null;
    sameTickerOpenTrades?: number;
  } = {}
): TradeRiskReport {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const daysToExpiry = daysBetween(today, trade.expiry);
  const factors: RiskFactor[] = [];
  const add = (factor: RiskFactor) => factors.push(factor);

  if (options.earningsDate && crossesEarnings(trade.expiry, options.earningsDate, today)) {
    add({
      id: "earnings",
      label: "Earnings before expiry",
      detail: `${trade.ticker} reports on ${options.earningsDate}. Event volatility can overwhelm normal option decay.`,
      points: 25,
      level: "high",
    });
  } else {
    add({
      id: "earnings-clear",
      label: "No known earnings overlap",
      detail: options.earningsDate
        ? `The next saved earnings date is after this trade expires.`
        : "No upcoming earnings overlap is currently known.",
      points: 0,
      level: "good",
    });
  }

  if (daysToExpiry <= 7) {
    add({
      id: "expiry",
      label: "Very short expiry window",
      detail: `${Math.max(0, daysToExpiry)} days remain. Gamma and assignment risk can change quickly.`,
      points: 22,
      level: "high",
    });
  } else if (daysToExpiry <= 21) {
    add({
      id: "expiry",
      label: "Short expiry window",
      detail: `${daysToExpiry} days remain, leaving less time to adjust the position.`,
      points: 12,
      level: "medium",
    });
  } else {
    add({
      id: "expiry",
      label: "Time to manage",
      detail: `${daysToExpiry} days remain until expiry.`,
      points: daysToExpiry <= 45 ? 5 : 0,
      level: daysToExpiry <= 45 ? "low" : "good",
    });
  }

  const distance = shortStrikeDistancePct(trade, options.spot);
  if (distance != null) {
    const points = distance <= 2 ? 28 : distance <= 5 ? 20 : distance <= 10 ? 10 : 0;
    add({
      id: "strike-distance",
      label: distance < 0 ? "Short strike is in the money" : "Distance to short strike",
      detail: `${Math.abs(distance).toFixed(1)}% ${distance < 0 ? "ITM" : "OTM"} at the latest stock price.`,
      points,
      level: points >= 20 ? "high" : points >= 10 ? "medium" : "good",
    });
  }

  const width = spreadWidth(trade);
  const credit = isDebitStrategy(trade.strategy) ? 0 : Math.abs(trade.premiumOpen);
  if (width > 0 && credit > 0) {
    const returnOnRisk = credit / Math.max(0.01, width - credit);
    if (returnOnRisk < 0.15) {
      add({
        id: "reward-risk",
        label: "Thin reward for defined risk",
        detail: `Opening credit is only ${(returnOnRisk * 100).toFixed(0)}% of maximum spread risk.`,
        points: 15,
        level: "medium",
      });
    } else {
      add({
        id: "reward-risk",
        label: "Defined reward and loss",
        detail: `Opening credit is ${(returnOnRisk * 100).toFixed(0)}% of maximum spread risk.`,
        points: 0,
        level: "good",
      });
    }
  } else if (trade.strategy === "Strangle") {
    add({
      id: "undefined-risk",
      label: "Undefined call-side risk",
      detail: "A short strangle can have losses beyond the cash reserved for put assignment.",
      points: 25,
      level: "high",
    });
  } else if (trade.strategy === "Cash-Secured Put" || trade.strategy === "Covered Call") {
    add({
      id: "assignment",
      label: "Assignment exposure",
      detail: "Be prepared to own or deliver 100 shares for each contract.",
      points: 10,
      level: "medium",
    });
  }

  if ((options.sameTickerOpenTrades ?? 0) > 1) {
    const count = options.sameTickerOpenTrades ?? 0;
    add({
      id: "concentration",
      label: "Ticker concentration",
      detail: `You now have ${count} open ${trade.ticker} positions exposed to the same move.`,
      points: Math.min(20, (count - 1) * 8),
      level: count >= 3 ? "high" : "medium",
    });
  }

  const delta = Math.abs(trade.delta || 0);
  if (delta >= 0.4) {
    add({
      id: "delta",
      label: "High opening delta",
      detail: `Saved delta is ${delta.toFixed(2)}, indicating meaningful directional exposure.`,
      points: 12,
      level: "medium",
    });
  }

  const score = Math.min(100, factors.reduce((sum, factor) => sum + factor.points, 0));
  const level =
    score >= 70 ? "High" : score >= 45 ? "Elevated" : score >= 20 ? "Moderate" : "Low";
  const capitalAtRisk = capitalUsed(trade);
  const assignmentExposure = assignmentCapital(trade);
  const maxProfit = Math.abs(trade.premiumOpen) * trade.contracts * 100;

  return {
    score,
    level,
    factors,
    daysToExpiry,
    capitalAtRisk,
    assignmentExposure,
    maxProfit,
  };
}
