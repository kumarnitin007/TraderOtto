export const STRATEGIES = [
  "Put Credit Spread",
  "Call Credit Spread",
  "Put Debit Spread",
  "Call Debit Spread",
  "Iron Condor",
  "Covered Call",
  "Cash-Secured Put",
  "Strangle",
  "Long Call",
  "Long Put",
] as const;

export type Strategy = (typeof STRATEGIES)[number];

/** Verticals and condors pair the sold strike with a protective strike you bought. */
export function hasLongLeg(strategy: Strategy | string) {
  return (
    strategy === "Put Credit Spread" ||
    strategy === "Call Credit Spread" ||
    strategy === "Put Debit Spread" ||
    strategy === "Call Debit Spread" ||
    strategy === "Iron Condor"
  );
}

/** One option only; the strike lives in shortStrike regardless of direction. */
export function isSingleLeg(strategy: Strategy | string) {
  return (
    strategy === "Covered Call" ||
    strategy === "Cash-Secured Put" ||
    strategy === "Long Call" ||
    strategy === "Long Put"
  );
}

/**
 * Debit positions are opened by paying premium, so they gain when the spread
 * gets richer. Credit positions gain when it gets cheaper.
 */
export function isDebitStrategy(strategy: Strategy | string) {
  return (
    strategy === "Long Call" ||
    strategy === "Long Put" ||
    strategy === "Put Debit Spread" ||
    strategy === "Call Debit Spread"
  );
}

export type TradeStatus = "open" | "closed";
export type CloseReason = "closed" | "expired" | "assigned" | "rolled";

/** Matches supabase/schema.sql columns (camelCase in the app). */
export type Trade = {
  id: string;
  userId?: string;
  ticker: string;
  strategy: Strategy | string;
  contracts: number;
  expiry: string;
  openDate: string;
  shortStrike: number | null;
  longStrike: number | null;
  callShortStrike: number | null;
  callLongStrike: number | null;
  stockPriceOpen: number;
  iv: number;
  delta: number;
  sigma: number;
  theta: number;
  premiumOpen: number;
  status: TradeStatus;
  closeDate: string | null;
  stockPriceClose: number | null;
  premiumClose: number | null;
  /** Total transaction costs in dollars, not per contract. */
  commissionOpen?: number;
  /** Total transaction costs in dollars, not per contract. */
  commissionClose?: number;
  closeReason?: CloseReason;
  rolledFromTradeId?: string | null;
  rolledToTradeId?: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type NewTrade = Omit<
  Trade,
  | "id"
  | "status"
  | "closeDate"
  | "stockPriceClose"
  | "premiumClose"
  | "commissionClose"
  | "closeReason"
  | "rolledToTradeId"
  | "createdAt"
  | "updatedAt"
  | "userId"
>;

export type ClosePayload = {
  closeDate: string;
  stockPriceClose: number;
  premiumClose: number;
  commissionClose?: number;
  closeReason?: CloseReason;
};

export type ClosedTradeImport = NewTrade & ClosePayload;

/** Open fields plus optional close fields when editing a closed trade. */
export type TradeUpdate = NewTrade & Partial<ClosePayload>;
