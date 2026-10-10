import { tradePnl } from "@/lib/pnl";
import {
  isIncompleteRobinhoodClose,
  sameTradeStructure,
} from "@/lib/tradeDuplicate";
import type { Trade } from "@/types/trade";

export type PotentialDuplicateGroup = {
  key: string;
  trades: Trade[];
  recommendedId: string | null;
  reason: string;
};

function value(value: number | null | undefined) {
  return value == null ? "—" : Number(value).toFixed(4);
}

function lifecycleKey(trade: Trade) {
  return [
    trade.ticker.toUpperCase(),
    trade.strategy,
    trade.status,
    trade.status === "closed" ? trade.closeDate : trade.openDate,
    trade.expiry,
    trade.contracts,
    value(trade.shortStrike),
    value(trade.longStrike),
    value(trade.callShortStrike),
    value(trade.callLongStrike),
  ].join("|");
}

export function isRobinhoodCsvTrade(trade: Trade) {
  return trade.importSource === "robinhood_csv";
}

function pnlCloseEnough(trades: Trade[]) {
  const pnls = trades
    .map(tradePnl)
    .filter((pnl): pnl is number => pnl != null);
  if (pnls.length < 2) return true;
  const spread = Math.max(...pnls) - Math.min(...pnls);
  const largest = Math.max(1, ...pnls.map(Math.abs));
  return spread <= Math.max(5, largest * 0.02);
}

/**
 * Finds likely duplicate lifecycles while preserving legitimate repeated RH
 * fills. Closed trades intentionally ignore open date and small fee/P&L
 * differences because those are common manual-vs-broker discrepancies.
 */
export function potentialDuplicateTrades(
  trades: Trade[]
): PotentialDuplicateGroup[] {
  const grouped = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = lifecycleKey(trade);
    grouped.set(key, [...(grouped.get(key) ?? []), trade]);
  }

  const standard = Array.from(grouped, ([key, matches]) => {
    if (matches.length < 2 || !pnlCloseEnough(matches)) return null;
    const robinhood = matches.filter(isRobinhoodCsvTrade);
    const fingerprints = new Set(
      robinhood.map((trade) => trade.importFingerprint).filter(Boolean)
    );
    // Distinct broker activity fingerprints can represent separate identical
    // lots and should not be collapsed without a manual/non-broker counterpart.
    if (
      robinhood.length === matches.length &&
      fingerprints.size === robinhood.length
    ) {
      return null;
    }
    return {
      key,
      trades: matches.slice().sort((a, b) => {
        const sourceRank = Number(isRobinhoodCsvTrade(b)) - Number(isRobinhoodCsvTrade(a));
        return sourceRank || b.createdAt.localeCompare(a.createdAt);
      }),
      recommendedId: robinhood.length === 1 ? robinhood[0].id : null,
      reason:
        matches[0].status === "closed"
          ? "Same ticker, strategy, close date, expiry, contracts, and strikes; P/L differs only slightly."
          : "Same ticker, strategy, open date, expiry, contracts, and strikes.",
    } satisfies PotentialDuplicateGroup;
  }).filter((group): group is PotentialDuplicateGroup => group != null);

  const seen = new Set(standard.map((group) => group.key));
  return [...standard, ...closeOnlyShadows(trades).filter((group) => !seen.has(group.key))];
}

/**
 * A close imported from a file that lacked the opening credit, saved beside
 * the real closed trade. P/L can differ by the whole opening credit, so the
 * small-difference check above does not see it.
 */
function closeOnlyShadows(trades: Trade[]): PotentialDuplicateGroup[] {
  const grouped = new Map<string, Trade[]>();
  for (const trade of trades) {
    if (trade.status !== "closed" || !trade.closeDate) continue;
    const key = lifecycleKey(trade);
    grouped.set(key, [...(grouped.get(key) ?? []), trade]);
  }
  return Array.from(grouped, ([key, matches]): PotentialDuplicateGroup | null => {
    if (matches.length < 2) return null;
    const incomplete = matches.filter((trade) => isIncompleteRobinhoodClose(trade));
    const complete = matches.filter((trade) => !isIncompleteRobinhoodClose(trade));
    if (!incomplete.length || !complete.length) return null;
    if (!matches.every((trade) => sameTradeStructure(matches[0], trade))) return null;
    const recommended =
      complete.slice().sort((a, b) => Math.abs(b.premiumOpen) - Math.abs(a.premiumOpen))[0] ??
      null;
    return {
      key: `close-only|${key}`,
      trades: matches.slice().sort((a, b) => Math.abs(b.premiumOpen) - Math.abs(a.premiumOpen)),
      recommendedId: recommended?.id ?? null,
      reason:
        "One row is a Robinhood close imported without its opening credit. Keep the row that has the opening premium.",
    } satisfies PotentialDuplicateGroup;
  }).filter((group): group is PotentialDuplicateGroup => group != null);
}
