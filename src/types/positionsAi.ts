export type AiPortfolioReport = {
  asOf: string;
  headline: string;
  bookRisk: { level: "low" | "medium" | "high"; drivers: string[] };
  catalysts: {
    date: string;
    scope: string;
    event: string;
    affects: number[];
    impact: "low" | "medium" | "high";
    note: string;
    sourceUrl: string;
  }[];
  positions: {
    id: number;
    tkr: string;
    risk: "low" | "medium" | "high";
    action: "hold" | "watch" | "reduce" | "close" | "roll";
    by: string;
    why: string;
    nonObvious: string;
    volumeSignal: string;
  }[];
  concentration: { factor: string; ids: number[]; note: string }[];
  mispriced: { id: number; view: "rich" | "cheap" | "fair"; note: string }[];
  scenarios: {
    name: string;
    trigger: string;
    bookImpact: string;
    firstToBreak: string;
  }[];
  blindSpots: string[];
  verify: { claim: string; why: string }[];
};

export type SavedAiPortfolioReport = {
  id: string;
  createdAt: string;
  model: string | null;
  report: AiPortfolioReport;
  tokensIn: number | null;
  tokensOut: number | null;
};

export type AiWatchlistReport = {
  asOf: string;
  headline: string;
  marketBackdrop: string;
  candidates: {
    id: number;
    tkr: string;
    rank: number;
    setup: "ready" | "watch" | "avoid";
    bias: "bullish" | "bearish" | "neutral";
    entryTrigger: string;
    invalidation: string;
    strategy: string;
    why: string;
    events: string;
    volumeSignal: string;
    sourceUrl: string;
  }[];
  correlations: { factor: string; ids: number[]; note: string }[];
  avoid: { id: number; reason: string }[];
  verify: { claim: string; why: string }[];
};
