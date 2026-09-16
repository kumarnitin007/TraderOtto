import { STRATEGIES, type Strategy } from "@/types/trade";
import type { AiPerformanceReport } from "@/types/performanceAi";

export const AI_TRADE_DRAFT_KEY = "trader-otto:ai-trade-draft";

const CODE_TO_STRATEGY: Record<string, Strategy> = {
  pcs: "Put Credit Spread",
  ccs: "Call Credit Spread",
  pds: "Put Debit Spread",
  cds: "Call Debit Spread",
  ic: "Iron Condor",
  csp: "Cash-Secured Put",
  cc: "Covered Call",
  strangle: "Strangle",
  stg: "Strangle",
  "long call": "Long Call",
  "long put": "Long Put",
};

export type AiTradeDraft = {
  ticker: string;
  strategy: Strategy | null;
  notes: string;
  rolledFromTradeId?: string;
};

export function matchAiStrategy(value: string): Strategy | null {
  const normalized = value.trim().toLowerCase();
  const exact = STRATEGIES.find(
    (strategy) => strategy.toLowerCase() === normalized
  );
  if (exact) return exact;
  if (CODE_TO_STRATEGY[normalized]) return CODE_TO_STRATEGY[normalized];
  return (
    STRATEGIES.find(
      (strategy) =>
        normalized.includes(strategy.toLowerCase()) ||
        strategy.toLowerCase().includes(normalized)
    ) ?? null
  );
}

export function tradeDraftFromIdea(
  idea: AiPerformanceReport["tradeIdeas"][number],
  report: AiPerformanceReport
): AiTradeDraft {
  return {
    ticker: idea.ticker.toUpperCase(),
    strategy: matchAiStrategy(idea.strategy),
    notes: [
      `AI performance idea (${report.asOf})`,
      idea.setup,
      `Wait for: ${idea.entryTrigger}`,
      `Invalid if: ${idea.invalidation}`,
      `Fit: ${idea.whyFitsStyle}`,
      `Risk: ${idea.risk}`,
      idea.sourceUrl ? `Source: ${idea.sourceUrl}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
