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

function sameStructure(
  existing: Pick<
    Trade,
    | "ticker"
    | "strategy"
    | "contracts"
    | "expiry"
    | "shortStrike"
    | "longStrike"
    | "callShortStrike"
    | "callLongStrike"
  >,
  candidate: Pick<
    TradeImport,
    | "ticker"
    | "strategy"
    | "contracts"
    | "expiry"
    | "shortStrike"
    | "longStrike"
    | "callShortStrike"
    | "callLongStrike"
  >
) {
  return (
    existing.ticker.toUpperCase() === candidate.ticker.toUpperCase() &&
    existing.strategy === candidate.strategy &&
    existing.contracts === candidate.contracts &&
    existing.expiry === candidate.expiry &&
    sameNumber(existing.shortStrike, candidate.shortStrike) &&
    sameNumber(existing.longStrike, candidate.longStrike) &&
    sameNumber(existing.callShortStrike, candidate.callShortStrike) &&
    sameNumber(existing.callLongStrike, candidate.callLongStrike)
  );
}

/**
 * A closed import closes an existing open trade with the same structure.
 * Open date is preferred when it matches; otherwise the oldest open trade wins.
 */
export function matchOpenTradesForClose(existing: Trade[], candidates: TradeImport[]) {
  const used = new Set<string>();
  return candidates.map((candidate) => {
    if (candidate.status !== "closed" || !candidate.closeDate) return null;
    const pool = existing.filter(
      (trade) =>
        trade.status === "open" &&
        !used.has(trade.id) &&
        sameStructure(trade, candidate)
    );
    const match =
      pool.find((trade) => trade.openDate === candidate.openDate) ??
      pool.slice().sort((a, b) => a.openDate.localeCompare(b.openDate))[0] ??
      null;
    if (match) used.add(match.id);
    return match;
  });
}

/**
 * Finds a saved row that an import should update instead of duplicating.
 * Closed candidates consume open positions. Open candidates reconcile with
 * manually entered open rows, preferring the same opening date.
 */
export function matchTradesForImport(existing: Trade[], candidates: TradeImport[]) {
  const closingMatches = matchOpenTradesForClose(existing, candidates);
  const used = new Set(
    closingMatches
      .filter((trade): trade is Trade => Boolean(trade))
      .map((trade) => trade.id)
  );
  return candidates.map((candidate, index) => {
    if (closingMatches[index]) return closingMatches[index];
    if (candidate.status !== "open") return null;
    const pool = existing.filter(
      (trade) =>
        trade.status === "open" &&
        trade.importSource !== "robinhood_csv" &&
        !used.has(trade.id) &&
        sameStructure(trade, candidate)
    );
    const match =
      pool.find((trade) => trade.openDate === candidate.openDate) ??
      pool.slice().sort((a, b) => a.openDate.localeCompare(b.openDate))[0] ??
      null;
    if (match) used.add(match.id);
    return match;
  });
}

/** A closed Robinhood row already saved for the same position. */
export function closedImportCopy(
  existing: Trade[],
  candidate: TradeImport,
  openId: string
) {
  if (candidate.status !== "closed") return null;
  return (
    existing.find(
      (trade) =>
        trade.id !== openId &&
        trade.status === "closed" &&
        trade.importSource === "robinhood_csv" &&
        trade.closeDate === candidate.closeDate &&
        sameStructure(trade, candidate)
    ) ?? null
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

