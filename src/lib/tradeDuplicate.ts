import type { ClosedTradeImport, Trade } from "@/types/trade";

function sameNumber(a: number | null, b: number | null) {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) < 0.0001;
}

/** Stable business fields visible in a Robinhood realized-trade screenshot. */
export function isDuplicateClosedTrade(
  existing: Trade,
  candidate: ClosedTradeImport
) {
  return (
    existing.status === "closed" &&
    existing.ticker.toUpperCase() === candidate.ticker.toUpperCase() &&
    existing.strategy === candidate.strategy &&
    existing.contracts === candidate.contracts &&
    existing.expiry === candidate.expiry &&
    existing.closeDate === candidate.closeDate &&
    sameNumber(existing.shortStrike, candidate.shortStrike) &&
    sameNumber(existing.longStrike, candidate.longStrike) &&
    sameNumber(existing.callShortStrike, candidate.callShortStrike) &&
    sameNumber(existing.callLongStrike, candidate.callLongStrike) &&
    sameNumber(existing.premiumOpen, candidate.premiumOpen) &&
    sameNumber(existing.premiumClose, candidate.premiumClose)
  );
}

