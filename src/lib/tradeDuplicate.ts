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

/** A Robinhood close saved before the opening credit was available. */
export function isIncompleteRobinhoodClose(
  trade: Pick<Trade, "status" | "premiumOpen" | "importSource">
) {
  return (
    trade.status === "closed" &&
    trade.importSource === "robinhood_csv" &&
    Math.abs(trade.premiumOpen) < 0.011
  );
}

/** Closing fills whose file did not contain the opening order. */
export function isOpeningMissingImport(candidate: TradeImport) {
  return candidate.status === "closed" && candidate.openingMissing === true;
}

export function sameTradeStructure(
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

function sameStructure(
  existing: Parameters<typeof sameTradeStructure>[0],
  candidate: Parameters<typeof sameTradeStructure>[1]
) {
  return sameTradeStructure(existing, candidate);
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

function completeCloseFor(
  existing: Trade[],
  candidate: TradeImport,
  closeDate: string | null | undefined
) {
  if (!closeDate) return null;
  return (
    existing.find(
      (trade) =>
        trade.status === "closed" &&
        !isIncompleteRobinhoodClose(trade) &&
        trade.closeDate === closeDate &&
        sameStructure(trade, candidate)
    ) ?? null
  );
}

/**
 * Finds a saved row that an import should update instead of duplicating.
 * A close consumes an open position. An opening file repairs a close that was
 * saved earlier without its credit, or refreshes that credit on the closed row.
 * Open candidates still reconcile with a manually entered open position.
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

    if (isOpeningMissingImport(candidate)) {
      const completed = completeCloseFor(existing, candidate, candidate.closeDate);
      if (completed && !used.has(completed.id)) {
        used.add(completed.id);
        return completed;
      }
      return null;
    }

    if (candidate.status === "closed" && candidate.closeDate) {
      const placeholder = existing.find(
        (trade) =>
          !used.has(trade.id) &&
          isIncompleteRobinhoodClose(trade) &&
          trade.closeDate === candidate.closeDate &&
          sameStructure(trade, candidate)
      );
      if (placeholder) {
        used.add(placeholder.id);
        return placeholder;
      }
      return null;
    }

    if (candidate.status !== "open") return null;

    const recordedOpen = existing.find(
      (trade) =>
        !used.has(trade.id) &&
        trade.status === "closed" &&
        trade.importSource === "robinhood_csv" &&
        !isIncompleteRobinhoodClose(trade) &&
        trade.openDate === candidate.openDate &&
        sameStructure(trade, candidate)
    );
    if (recordedOpen) {
      used.add(recordedOpen.id);
      return recordedOpen;
    }

    const incomplete = existing
      .filter((trade) => {
        if (used.has(trade.id) || !isIncompleteRobinhoodClose(trade)) return false;
        if (!sameStructure(trade, candidate)) return false;
        if (trade.closeDate && trade.closeDate < candidate.openDate) return false;
        return !completeCloseFor(existing, candidate, trade.closeDate);
      })
      .sort((a, b) => (a.closeDate ?? "").localeCompare(b.closeDate ?? ""));
    if (incomplete[0]) {
      used.add(incomplete[0].id);
      return incomplete[0];
    }

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

export type ImportUpdate = {
  status: "open" | "closed";
  strategy: string;
  contracts: number;
  openDate: string;
  closeDate: string | null;
  premiumOpen: number;
  premiumClose: number | null;
  commissionOpen: number;
  commissionClose: number;
  closeReason: Trade["closeReason"];
  stockPriceClose: number | null;
  note: string;
};

/** Merges a CSV row onto a saved trade without dropping a close that arrived first. */
export function applyImportToTrade(match: Trade, item: TradeImport): ImportUpdate {
  const fillingOpeningOnClose = item.status !== "closed" && match.status === "closed";
  const useImportedOpening = fillingOpeningOnClose || !item.openingMissing;
  const itemCloses =
    item.status === "closed" && Boolean(item.closeDate) && item.premiumClose != null;
  const closed = fillingOpeningOnClose || itemCloses;
  const premiumOpen = useImportedOpening ? item.premiumOpen : match.premiumOpen;
  const commissionOpen = useImportedOpening
    ? item.commissionOpen ?? 0
    : match.commissionOpen ?? 0;
  return {
    status: closed ? "closed" : "open",
    strategy: useImportedOpening ? item.strategy : match.strategy,
    contracts: useImportedOpening ? item.contracts : match.contracts,
    openDate: useImportedOpening ? item.openDate : match.openDate,
    closeDate: fillingOpeningOnClose
      ? match.closeDate
      : itemCloses
        ? item.closeDate ?? null
        : null,
    premiumOpen,
    premiumClose: closed
      ? fillingOpeningOnClose
        ? match.premiumClose
        : item.premiumClose ?? null
      : null,
    commissionOpen,
    commissionClose: fillingOpeningOnClose
      ? match.commissionClose ?? 0
      : itemCloses
        ? item.commissionClose ?? 0
        : 0,
    closeReason: fillingOpeningOnClose
      ? match.closeReason ?? "closed"
      : itemCloses
        ? item.closeReason ?? "closed"
        : undefined,
    stockPriceClose: closed
      ? fillingOpeningOnClose
        ? match.stockPriceClose ?? 0
        : item.stockPriceClose ?? 0
      : null,
    note: fillingOpeningOnClose
      ? "Opening credit added from Robinhood activity CSV."
      : closed
        ? "Closed from Robinhood activity CSV."
        : "Updated from Robinhood activity CSV.",
  };
}

/** Extra close-only rows that belong to the trade an import is updating. */
export function staleCloseCopies(existing: Trade[], item: TradeImport, keep: Trade) {
  const closeDate = item.status === "closed" ? item.closeDate ?? keep.closeDate : keep.closeDate;
  return existing.filter((trade) => {
    if (trade.id === keep.id) return false;
    if (item.importFingerprint && trade.importFingerprint === item.importFingerprint) {
      return true;
    }
    if (!closeDate || !isIncompleteRobinhoodClose(trade)) return false;
    return trade.closeDate === closeDate && sameStructure(trade, item);
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
  if (
    isOpeningMissingImport(candidate) &&
    candidate.closeDate &&
    existing.status === "closed" &&
    existing.closeDate === candidate.closeDate &&
    sameStructure(existing, candidate)
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

