export type PerformanceAiMode =
  | "performance_review"
  | "performance_trade_ideas"
  | "performance_coach";

export type PerformanceAiRange =
  | "week"
  | "month"
  | "3m"
  | "ytd"
  | "year"
  | "5y"
  | "all";

export type AiPerformanceReport = {
  asOf: string;
  mode: "review" | "trade_ideas" | "coach";
  period: {
    label: string;
    start: string;
    end: string;
    tradeCount: number;
  };
  headline: string;
  verdict: string;
  scorecard: {
    realizedPnl: number;
    winRate: number;
    avgRoi: number;
    avgHoldDays: number;
    bestDimension: string;
    worstDimension: string;
  };
  findings: {
    title: string;
    evidence: string;
    tradeIds: number[];
    significance: "low" | "medium" | "high";
  }[];
  tradeIdeas: {
    ticker: string;
    bias: "bullish" | "bearish" | "neutral";
    strategy: string;
    setup: string;
    entryTrigger: string;
    invalidation: string;
    whyFitsStyle: string;
    risk: string;
    sourceUrl: string;
  }[];
  improvements: {
    priority: number;
    change: string;
    evidence: string;
    implementation: string;
    measure: string;
  }[];
  strengths: string[];
  cautions: string[];
  verify: { claim: string; why: string }[];
};

export type SavedAiPerformanceReport = {
  id: string;
  createdAt: string;
  model: string | null;
  report: AiPerformanceReport;
  portfolioHash: string | null;
  contextId: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
};
