import type { OptionMark } from "@/hooks/useOptionMarks";
import type { LiveQuote } from "@/hooks/useLiveQuotes";
import type { TickerTechnical } from "@/lib/alpacaServer";
import { todayISO } from "@/lib/pnl";
import type { Trade } from "@/types/trade";
import type { WatchGroup } from "@/types/watchGroup";

/** Short codes keep the CSV cheap; the prompt carries a one-line legend. */
const STRATEGY_CODE: Record<string, string> = {
  "Put Credit Spread": "PCS",
  "Call Credit Spread": "CCS",
  "Put Debit Spread": "PDS",
  "Call Debit Spread": "CDS",
  "Iron Condor": "IC",
  "Covered Call": "CC",
  "Cash-Secured Put": "CSP",
  Strangle: "STG",
  "Long Call": "LC",
  "Long Put": "LP",
};

export type TickerContext = {
  earningsDate: string | null;
  earningsTiming: string | null;
  sector: string | null;
};

/** Earnings and sector come from the journal's own cache, not from the model. */
export function tickerContextFromGroups(groups: WatchGroup[]) {
  const context: Record<string, TickerContext> = {};
  for (const group of groups) {
    for (const tracker of group.trackers) {
      const current = context[tracker.ticker];
      context[tracker.ticker] = {
        earningsDate: tracker.earningsDate ?? current?.earningsDate ?? null,
        earningsTiming: tracker.earningsTiming ?? current?.earningsTiming ?? null,
        sector: tracker.sector ?? current?.sector ?? null,
      };
    }
  }
  return context;
}

function num(value: number | null | undefined, digits = 2) {
  return value == null ? "" : String(Number(value.toFixed(digits)));
}

function csvText(value: string | null | undefined) {
  if (!value) return "";
  return value.includes(",") ? value.replace(/,/g, " ") : value;
}

/**
 * Only fields the model cannot derive. Greeks, DTE, P/L, capital at risk, and
 * breakevens all follow from strikes, premium, mark, spot, IV, and the dates.
 */
function positionRow(
  index: number,
  trade: Trade,
  quotes: Record<string, LiveQuote>,
  marks: Record<string, OptionMark>,
  context: Record<string, TickerContext>,
  technicals: Record<string, TickerTechnical>
) {
  const mark = marks[trade.id];
  const info = context[trade.ticker];
  const technical = technicals[trade.ticker];
  const earnings = info?.earningsDate
    ? `${info.earningsDate}${info.earningsTiming ? ` ${info.earningsTiming.toLowerCase().includes("before") ? "bmo" : info.earningsTiming.toLowerCase().includes("after") ? "amc" : ""}` : ""}`.trim()
    : "";
  return [
    index + 1,
    trade.ticker,
    STRATEGY_CODE[trade.strategy] ?? trade.strategy,
    trade.contracts,
    num(trade.shortStrike),
    num(trade.longStrike),
    num(trade.callShortStrike),
    num(trade.callLongStrike),
    trade.expiry,
    trade.openDate,
    num(Math.abs(trade.premiumOpen)),
    num(mark?.mark),
    num(quotes[trade.ticker]?.price || null),
    num(mark?.iv, 3),
    earnings,
    csvText(info?.sector),
    num(technical?.sma20),
    num(technical?.sma50),
    num(technical?.volumeRatio),
    num(technical?.vwap),
  ].join(",");
}

export function openPositionsPrompt(
  trades: Trade[],
  quotes: Record<string, LiveQuote>,
  marks: Record<string, OptionMark>,
  context: Record<string, TickerContext> = {},
  technicals: Record<string, TickerTechnical> = {}
) {
  const open = trades.filter((trade) => trade.status === "open");
  const rows = open.map((trade, index) =>
    positionRow(index, trade, quotes, marks, context, technicals)
  );

  return `You are an options risk analyst reviewing my open book. Today is ${todayISO()}.

Conventions: prices are per share (x100 per contract). Credit strategies (PCS, CCS, IC, CC, CSP, STG) profit as the mark falls; debit strategies (PDS, CDS, LC, LP) profit as it rises. iv is decimal; volx is latest daily stock volume / prior 20-day average. earn is cached and may be stale. Blank means unknown.

Codes: PCS/CCS put/call credit spread, PDS/CDS put/call debit spread, IC iron condor, CC covered call, CSP cash-secured put, STG strangle, LC long call, LP long put.

id,tkr,strat,qty,p_short,p_long,c_short,c_long,exp,opened,prem,mark,spot,iv,earn,sector,sma20,sma50,volx,vwap
${rows.length ? rows.join("\n") : "(no open positions)"}

Derive everything computable yourself and never ask me for it or restate it: DTE, unrealized P/L, capital at risk, max profit/loss, breakevens, distance to short strike, percent of credit captured, and Greeks. I already see those.

Tell me only what I cannot see on this screen:

1. Use web search to build a dated catalyst map through each expiry. Verify dates against primary sources where possible. Include company events (earnings, guidance, investor days, product launches, ex-dividend dates, rebalances, lockups) and macro events (CPI, PCE, NFP, FOMC, GDP, ISM, Treasury auctions, OPEX/triple witching). Flag positions crossing a binary event.

2. Hidden factor concentration. Which positions look diversified by ticker but are the same bet (shared sector, supply chain, AI capex, rate or dollar sensitivity, high mutual beta), how much of the book moves together, and what one macro shock does to all of them at once.

3. Where the premium does not match the event risk. Is IV rich or cheap relative to the catalyst calendar and the usual post-event crush, and am I short volatility into a known event without being paid for it.

4. Decision sequencing. Which position forces a decision first, on what date or price trigger, plus gamma and pin risk in the final week and any assignment or exercise specifics.

5. Tail scenarios. One plausible adverse move and one stress move: what breaks first, roughly how correlated the drawdown is, and which assumption in this book fails.

6. Volume/price confirmation. Explain unusual volx, price versus SMA20/SMA50 and VWAP, breakouts or failed moves, and whether volume confirms or contradicts the option thesis. Do not claim volume predicts direction by itself.

7. Blind spots. Positions working against each other, duplicated exposure, sizing inconsistent with the risk, or anything in the data that contradicts itself.

Respond with JSON only, no text outside the JSON:
{"asOf":"YYYY-MM-DD","headline":"","bookRisk":{"level":"low|medium|high","drivers":[""]},"catalysts":[{"date":"YYYY-MM-DD","scope":"macro|TKR","event":"","affects":[1],"impact":"low|medium|high","note":"","sourceUrl":""}],"positions":[{"id":1,"tkr":"","risk":"low|medium|high","action":"hold|watch|reduce|close|roll","by":"date or price trigger","why":"","nonObvious":"","volumeSignal":""}],"concentration":[{"factor":"","ids":[1],"note":""}],"mispriced":[{"id":1,"view":"rich|cheap|fair","note":""}],"scenarios":[{"name":"","trigger":"","bookImpact":"","firstToBreak":""}],"blindSpots":[""],"verify":[{"claim":"","why":""}]}

Keep every string under 200 characters. Prefix any date you are not certain about with "~" and list it in verify. This is decision support, not an instruction to trade.`;
}
