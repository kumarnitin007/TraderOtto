import {
  closedTradesInRange,
  PNL_RANGE_OPTIONS,
  rangeStart,
  todayISO,
  tradePnl,
} from "@/lib/pnl";
import { tradeRoi } from "@/lib/roi";
import { closedEarly } from "@/lib/tickerStats";
import type {
  PerformanceAiMode,
  PerformanceAiRange,
} from "@/types/performanceAi";
import type { Trade } from "@/types/trade";

const MAX_ROWS = 120;

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

export const PERFORMANCE_AI_RANGES: {
  value: PerformanceAiRange;
  label: string;
}[] = PNL_RANGE_OPTIONS.map((option) => ({
  value: option.id,
  label: option.label,
}));

export const PERFORMANCE_AI_MODES: {
  value: PerformanceAiMode;
  label: string;
  description: string;
}[] = [
  {
    value: "performance_review",
    label: "Review my performance",
    description: "Summarize results and explain what actually drove them.",
  },
  {
    value: "performance_trade_ideas",
    label: "Suggest next trades",
    description: "Find setups that fit your demonstrated trading style.",
  },
  {
    value: "performance_coach",
    label: "Improve my system",
    description: "Turn repeated strengths and mistakes into concrete rules.",
  },
];

export function performanceTradesInRange(
  trades: Trade[],
  range: PerformanceAiRange,
  now = new Date()
) {
  return closedTradesInRange(trades, range, now)
    .sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? ""));
}

export function performanceRangeLabel(range: PerformanceAiRange) {
  return (
    PERFORMANCE_AI_RANGES.find((option) => option.value === range)?.label ??
    "Selected period"
  );
}

export function localPerformanceSnapshot(trades: Trade[]) {
  const scored = trades.flatMap((trade) => {
    const pnl = tradePnl(trade);
    return pnl == null ? [] : [{ trade, pnl, roi: tradeRoi(trade) }];
  });
  const realized = scored.reduce((sum, item) => sum + item.pnl, 0);
  const wins = scored.filter((item) => item.pnl > 0).length;
  const roiRows = scored.filter(
    (item): item is typeof item & { roi: NonNullable<typeof item.roi> } =>
      item.roi != null
  );
  const avgRoi = roiRows.length
    ? roiRows.reduce((sum, item) => sum + item.roi.roi, 0) / roiRows.length
    : null;
  const avgHoldDays = roiRows.length
    ? roiRows.reduce((sum, item) => sum + item.roi.days, 0) / roiRows.length
    : null;
  const earlyCount = scored.filter((item) => closedEarly(item.trade)).length;

  return {
    tradeCount: scored.length,
    realized,
    wins,
    winRate: scored.length ? wins / scored.length : null,
    avgRoi,
    avgHoldDays,
    earlyExitPct: scored.length ? earlyCount / scored.length : null,
  };
}

function clean(value: string | null | undefined, max = 80) {
  return (value ?? "")
    .replace(/[\r\n,]+/g, " ")
    .trim()
    .slice(0, max);
}

function num(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value)
    ? ""
    : String(Number(value.toFixed(digits)));
}

function aggregateRows(trades: Trade[], field: "strategy" | "ticker") {
  const grouped = new Map<string, { count: number; wins: number; pnl: number }>();
  for (const trade of trades) {
    const pnl = tradePnl(trade);
    if (pnl == null) continue;
    const key = trade[field];
    const current = grouped.get(key) ?? { count: 0, wins: 0, pnl: 0 };
    current.count += 1;
    current.wins += pnl > 0 ? 1 : 0;
    current.pnl += pnl;
    grouped.set(key, current);
  }
  return [...grouped.entries()]
    .sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
    .slice(0, 20)
    .map(
      ([name, value]) =>
        `${clean(name, 35)}:${value.count} trades/${value.wins} wins/$${num(value.pnl)}`
    )
    .join(" | ");
}

function tradeRow(trade: Trade, index: number) {
  const roi = tradeRoi(trade);
  return [
    index + 1,
    trade.ticker,
    STRATEGY_CODE[trade.strategy] ?? clean(trade.strategy, 20),
    trade.contracts,
    trade.openDate,
    trade.closeDate,
    trade.expiry,
    num(trade.shortStrike),
    num(trade.longStrike),
    num(trade.callShortStrike),
    num(trade.callLongStrike),
    num(Math.abs(trade.premiumOpen)),
    num(trade.premiumClose == null ? null : Math.abs(trade.premiumClose)),
    num(trade.stockPriceOpen),
    num(trade.stockPriceClose),
    num(tradePnl(trade)),
    num(roi == null ? null : roi.capital),
    num(roi == null ? null : roi.roi * 100),
    roi?.days ?? "",
    closedEarly(trade) ? "yes" : "no",
    trade.closeReason ?? "closed",
    num((trade.commissionOpen ?? 0) + (trade.commissionClose ?? 0)),
    trade.rolledFromTradeId ?? "",
    clean(trade.notes, 60),
  ].join(",");
}

function modeInstructions(mode: PerformanceAiMode) {
  if (mode === "performance_trade_ideas") {
    return `Goal: suggest 3-5 next trade candidates that fit the trader's proven strengths without repeating their costly patterns.

Use web search to check current market conditions and dated catalysts. Prefer tickers previously traded only when the record supports that fit; you may introduce a new liquid ticker when it clearly matches the trader's demonstrated edge. Suggest strategy families and entry conditions, not invented option strikes, expirations, premiums, IV rank, liquidity, or expected moves. Every idea needs a sourceUrl and must state why it fits this specific history. Put ideas in tradeIdeas; also include supporting findings and risk-control improvements.`;
  }
  if (mode === "performance_coach") {
    return `Goal: convert the journal into a small, measurable trading playbook.

Find repeated behaviors involving strategy choice, sizing, hold time, early exits, ticker concentration, win/loss asymmetry, and ROI. Separate evidence from plausible interpretation. Put the highest-value changes in improvements with an exact implementation rule and a way to measure it over the next 10-20 trades. Leave tradeIdeas empty.`;
  }
  return `Goal: give a clear retrospective performance review.

Explain what drove the result, what worked, what failed, whether profits depend on a small number of outliers, and how results differ by strategy, ticker, holding time, and early versus expiry exits. Do not merely restate the supplied totals. Put the most decision-relevant evidence in findings and practical follow-ups in improvements. Leave tradeIdeas empty.`;
}

export function performanceAiPrompt(
  allTrades: Trade[],
  range: PerformanceAiRange,
  mode: PerformanceAiMode,
  now = new Date()
) {
  const selected = performanceTradesInRange(allTrades, range, now);
  const rows = selected.slice(0, MAX_ROWS);
  const snapshot = localPerformanceSnapshot(selected);
  const start = rangeStart(range, now);
  const label = performanceRangeLabel(range);
  const omitted = Math.max(0, selected.length - rows.length);

  return `You are an evidence-driven options trading performance analyst. Review my closed-trade journal, infer my demonstrated trading style, and answer the requested question. Today is ${todayISO(now)}.

Analysis period: ${label}; ${start ? todayISO(start) : "first recorded trade"} through ${todayISO(now)}.
Closed trades: ${snapshot.tradeCount}; realized P/L: $${num(snapshot.realized)}; wins: ${snapshot.wins}; win rate: ${num(snapshot.winRate == null ? null : snapshot.winRate * 100)}%; average ROI: ${num(snapshot.avgRoi == null ? null : snapshot.avgRoi * 100)}%; average hold: ${num(snapshot.avgHoldDays, 1)} days; closed early: ${num(snapshot.earlyExitPct == null ? null : snapshot.earlyExitPct * 100)}%.
By strategy: ${aggregateRows(selected, "strategy") || "none"}
By ticker: ${aggregateRows(selected, "ticker") || "none"}

Conventions: prices and premiums are per share; each option contract controls 100 shares. pnl and ROI are already computed net of recorded fees and must be treated as authoritative. A winning trade has pnl > 0. "early" means closed before expiry. reason distinguishes closed, expired, assigned, and rolled. roll_from links a replacement trade to its prior leg. Blank means unknown. Codes: PCS/CCS put/call credit spread, PDS/CDS put/call debit spread, IC iron condor, CC covered call, CSP cash-secured put, STG strangle, LC long call, LP long put.

id,tkr,strat,qty,opened,closed,expiry,p_short,p_long,c_short,c_long,prem_open,prem_close,spot_open,spot_close,pnl,capital,roi_pct,hold_days,early,reason,fees,roll_from,notes
${rows.length ? rows.map(tradeRow).join("\n") : "(no closed trades)"}
${omitted ? `The ${omitted} oldest rows were omitted for token efficiency; aggregate totals above include them.` : ""}

${modeInstructions(mode)}

Analysis rules:
1. Cite journal evidence using the numeric trade IDs. Do not claim causation when the journal only shows correlation.
2. Account for sample size. If fewer than 10 trades support a conclusion, label it tentative.
3. Do not reward win rate alone; examine P/L, ROI, loss size, holding time, and concentration together.
4. Do not invent missing market context, fills, Greeks, commissions, taxes, or reasons for entry/exit.
5. In scorecard, copy realizedPnl from the snapshot. Return winRate and avgRoi as percentage points (for example, 62.5 means 62.5%), not decimals. Use 0 and explain in cautions when a metric is unavailable.
6. Keep every string under 220 characters. Use numbers copied from the supplied snapshot where requested.
7. This is decision support, not an instruction to trade.

Return JSON only:
{"asOf":"YYYY-MM-DD","mode":"review|trade_ideas|coach","period":{"label":"","start":"YYYY-MM-DD or first recorded trade","end":"YYYY-MM-DD","tradeCount":0},"headline":"","verdict":"","scorecard":{"realizedPnl":0,"winRate":0,"avgRoi":0,"avgHoldDays":0,"bestDimension":"","worstDimension":""},"findings":[{"title":"","evidence":"","tradeIds":[1],"significance":"low|medium|high"}],"tradeIdeas":[{"ticker":"","bias":"bullish|bearish|neutral","strategy":"","setup":"","entryTrigger":"","invalidation":"","whyFitsStyle":"","risk":"","sourceUrl":""}],"improvements":[{"priority":1,"change":"","evidence":"","implementation":"","measure":""}],"strengths":[""],"cautions":[""],"verify":[{"claim":"","why":""}]}`;
}
