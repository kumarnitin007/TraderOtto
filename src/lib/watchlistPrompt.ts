import type { LiveQuote } from "@/hooks/useLiveQuotes";
import type { TickerTechnical } from "@/lib/alpacaServer";
import { todayISO } from "@/lib/pnl";
import type { WatchGroup } from "@/types/watchGroup";

function num(value: number | null | undefined, digits = 2) {
  return value == null ? "" : String(Number(value.toFixed(digits)));
}

function text(value: string | null | undefined, max = 100) {
  return (value ?? "").replace(/[\r\n,]+/g, " ").trim().slice(0, max);
}

export function watchlistPrompt(
  group: WatchGroup,
  quotes: Record<string, LiveQuote>,
  technicals: Record<string, TickerTechnical>
) {
  const rows = group.trackers.map((tracker, index) => {
    const technical = technicals[tracker.ticker];
    const earnings = tracker.earningsDate
      ? `${tracker.earningsDate} ${text(tracker.earningsTiming, 12)}`
      : "";
    return [
      index + 1,
      tracker.ticker,
      num(quotes[tracker.ticker]?.price || null),
      num(tracker.lowerTrigger),
      num(tracker.upperTrigger),
      text(tracker.sector, 40),
      earnings,
      num(technical?.sma20),
      num(technical?.sma50),
      num(technical?.volumeRatio),
      num(technical?.vwap),
      text(tracker.notes),
    ].join(",");
  });

  return `You are researching candidates in my "${text(group.name, 50)}" watchlist. Today is ${todayISO()}. This is an entry-selection task, not an open-position review.

Data: volx = latest daily stock volume / prior 20-day average. earn is cached and may be stale. low/high are my optional alert range, not analyst targets. Blank means unknown.

id,tkr,spot,low,high,sector,earn,sma20,sma50,volx,vwap,notes
${rows.length ? rows.join("\n") : "(empty list)"}

Use web search and primary sources where possible. Find information not visible in the rows and decide which names deserve deeper option-chain review now:

1. Rank candidates by quality and timing of a possible entry. Separate a good company from a good setup today.
2. Verify upcoming earnings and identify dated catalysts before the likely 30–60 day option window: earnings/guidance, investor days, launches, regulatory decisions, ex-dividend dates, macro releases and sector events.
3. Interpret price versus SMA20/SMA50/VWAP together with volx. Look for confirmed breakouts, breakdowns, failed moves, reversals, or low-volume noise. Volume confirms participation; it does not predict direction alone.
4. Identify support/resistance or a precise price/event trigger worth waiting for, plus an invalidation level. Respect my low/high range when present but challenge it when evidence disagrees.
5. Suggest an option strategy family suited to the thesis and event risk (credit/debit vertical, CSP, covered call, iron condor, long option, or no trade). Do not invent strikes, expiry, IV rank, bid/ask, open interest, or expected move. State that option-chain validation is required.
6. Detect correlated candidates that would duplicate one sector, factor, rate, dollar, commodity, or AI-capex bet.
7. Explicitly identify names to avoid for now because the setup, event timing, liquidity, or reward/risk is unclear.

Return JSON only. Keep strings under 200 characters. Every event-dependent recommendation needs a sourceUrl. Put uncertain claims in verify.

{"asOf":"YYYY-MM-DD","headline":"","marketBackdrop":"","candidates":[{"id":1,"tkr":"","rank":1,"setup":"ready|watch|avoid","bias":"bullish|bearish|neutral","entryTrigger":"","invalidation":"","strategy":"","why":"","events":"","volumeSignal":"","sourceUrl":""}],"correlations":[{"factor":"","ids":[1],"note":""}],"avoid":[{"id":1,"reason":""}],"verify":[{"claim":"","why":""}]}

This is research and decision support, not an instruction to trade.`;
}
