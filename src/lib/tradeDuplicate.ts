import type {
  ClosedTradeImport,
  Trade,
  TradeImport,
} from "@/types/trade";

function sameNumber(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) < 0.011;
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

/** Business-key fallback for CSV rows that predate source fingerprints. */
export function isDuplicateImportedTrade(
  existing: Trade,
  candidate: TradeImport
) {
  if (
    candidate.importFingerprint &&
    existing.importFingerprint === candidate.importFingerprint
  ) {
    return true;
  }
  return (
    existing.status === candidate.status &&
    existing.ticker.toUpperCase() === candidate.ticker.toUpperCase() &&
    existing.strategy === candidate.strategy &&
    existing.contracts === candidate.contracts &&
    existing.expiry === candidate.expiry &&
    existing.openDate === candidate.openDate &&
    sameNumber(existing.shortStrike, candidate.shortStrike) &&
    sameNumber(existing.longStrike, candidate.longStrike) &&
    sameNumber(existing.callShortStrike, candidate.callShortStrike) &&
    sameNumber(existing.callLongStrike, candidate.callLongStrike) &&
    sameNumber(existing.premiumOpen, candidate.premiumOpen) &&
    (candidate.status === "open" ||
      (existing.closeDate === candidate.closeDate &&
        sameNumber(existing.premiumClose, candidate.premiumClose)))
  );
}

/**
 * Assigns duplicates as a multiset: two identical Robinhood fills require two
 * matching Otto rows before both are classified as already imported.
 */
export function matchImportedTradeDuplicates(
  existing: Trade[],
  candidates: TradeImport[]
) {
  const used = new Set<string>();
  return candidates.map((candidate) => {
    const match = existing.find(
      (trade) =>
        !used.has(trade.id) && isDuplicateImportedTrade(trade, candidate)
    );
    if (match) used.add(match.id);
    return match ?? null;
  });
}

