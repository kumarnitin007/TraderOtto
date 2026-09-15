import type { LiveQuote } from "@/hooks/useLiveQuotes";
import type { OptionMark } from "@/hooks/useOptionMarks";
import type { TickerTechnical } from "@/lib/alpacaServer";
import { markPnl, todayISO } from "@/lib/pnl";
import type { TickerContext } from "@/lib/positionsPrompt";
import type { Trade } from "@/types/trade";

export type LocalInsight = {
  tone: "neutral" | "warning" | "danger";
  title: string;
  detail: string;
};

function daysUntil(date: string) {
  return Math.ceil(
    (new Date(`${date}T00:00:00Z`).getTime() -
      new Date(`${todayISO()}T00:00:00Z`).getTime()) /
      86_400_000
  );
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function buildLocalPositionInsights(
  trades: Trade[],
  quotes: Record<string, LiveQuote>,
  marks: Record<string, OptionMark>,
  technicals: Record<string, TickerTechnical>,
  context: Record<string, TickerContext>
) {
  const open = trades.filter((trade) => trade.status === "open");
  const insights: LocalInsight[] = [];
  const knownPnl = open.flatMap((trade) => {
    const mark = marks[trade.id];
    return mark ? [markPnl(trade, mark.mark)] : [];
  });
  const totalPnl = knownPnl.reduce((sum, pnl) => sum + pnl, 0);

  const soon = open.filter((trade) => daysUntil(trade.expiry) <= 7);
  if (soon.length) {
    insights.push({
      tone: soon.some((trade) => daysUntil(trade.expiry) <= 2)
        ? "danger"
        : "warning",
      title: `${soon.length} position${soon.length === 1 ? "" : "s"} expire within 7 days`,
      detail: soon
        .map((trade) => `${trade.ticker} ${daysUntil(trade.expiry)}D`)
        .join(" · "),
    });
  }

  const eventTrades = open.filter((trade) => {
    const date = context[trade.ticker]?.earningsDate;
    return date && date >= todayISO() && date <= trade.expiry;
  });
  if (eventTrades.length) {
    insights.push({
      tone: "danger",
      title: `${eventTrades.length} position${eventTrades.length === 1 ? "" : "s"} cross earnings`,
      detail: eventTrades
        .map(
          (trade) =>
            `${trade.ticker} ${context[trade.ticker].earningsDate}`
        )
        .join(" · "),
    });
  }

  const unusualVolume = Array.from(
    new Set(open.map((trade) => trade.ticker))
  ).flatMap((ticker) => {
    const ratio = technicals[ticker]?.volumeRatio;
    return ratio != null && ratio >= 1.5 ? [{ ticker, ratio }] : [];
  });
  if (unusualVolume.length) {
    insights.push({
      tone: unusualVolume.some(({ ratio }) => ratio >= 2) ? "danger" : "warning",
      title: "Unusual stock volume",
      detail: unusualVolume
        .map(({ ticker, ratio }) => `${ticker} ${ratio.toFixed(1)}× 20-day average`)
        .join(" · "),
    });
  }

  const technicalPressure = Array.from(
    new Set(open.map((trade) => trade.ticker))
  ).flatMap((ticker) => {
    const quote = quotes[ticker]?.price;
    const stats = technicals[ticker];
    if (!quote || !stats?.sma20 || !stats.sma50) return [];
    if (quote < stats.sma20 && quote < stats.sma50) {
      return [{ ticker, direction: "below" }];
    }
    if (quote > stats.sma20 && quote > stats.sma50) {
      return [{ ticker, direction: "above" }];
    }
    return [];
  });
  if (technicalPressure.length) {
    insights.push({
      tone: "neutral",
      title: "Price versus 20/50-day averages",
      detail: technicalPressure
        .map(({ ticker, direction }) => `${ticker} ${direction} both averages`)
        .join(" · "),
    });
  }

  const closeToStrike = open.flatMap((trade) => {
    const spot = quotes[trade.ticker]?.price;
    const strikes = [trade.shortStrike, trade.callShortStrike].filter(
      (strike): strike is number => strike != null
    );
    if (!spot || !strikes.length) return [];
    const distance = Math.min(
      ...strikes.map((strike) => (Math.abs(spot - strike) / spot) * 100)
    );
    return distance <= 3 ? [{ trade, distance }] : [];
  });
  if (closeToStrike.length) {
    insights.push({
      tone: "warning",
      title: "Stock price near a short strike",
      detail: closeToStrike
        .map(
          ({ trade, distance }) =>
            `${trade.ticker} ${percent(distance)} away`
        )
        .join(" · "),
    });
  }

  const tickerCounts = new Map<string, number>();
  for (const trade of open) {
    tickerCounts.set(trade.ticker, (tickerCounts.get(trade.ticker) ?? 0) + 1);
  }
  const concentrated = [...tickerCounts].filter(([, count]) => count > 1);
  if (concentrated.length) {
    insights.push({
      tone: "warning",
      title: "Repeated ticker exposure",
      detail: concentrated
        .map(([ticker, count]) => `${ticker} ${count} positions`)
        .join(" · "),
    });
  }

  return {
    openCount: open.length,
    markedCount: knownPnl.length,
    totalPnl,
    insights,
  };
}
