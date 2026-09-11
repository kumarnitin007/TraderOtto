export const STRATEGIES = [
  "Put Credit Spread",
  "Call Credit Spread",
  "Put Debit Spread",
  "Call Debit Spread",
  "Iron Condor",
  "Covered Call",
  "Cash-Secured Put",
  "Strangle",
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

/** Covered calls and cash-secured puts record only the strike you sold. */
export function isSingleLeg(strategy: Strategy | string) {
  return strategy === "Covered Call" || strategy === "Cash-Secured Put";
}

export type TradeStatus = "open" | "closed";

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
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type NewTrade = Omit<
  Trade,
  "id" | "status" | "closeDate" | "stockPriceClose" | "premiumClose" | "createdAt" | "updatedAt" | "userId"
>;

export type ClosePayload = {
  closeDate: string;
  stockPriceClose: number;
  premiumClose: number;
};

/** Open fields plus optional close fields when editing a closed trade. */
export type TradeUpdate = NewTrade & Partial<ClosePayload>;
