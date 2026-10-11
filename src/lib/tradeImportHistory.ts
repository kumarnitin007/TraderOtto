import { matchTradesForImport, staleCloseCopies } from "@/lib/tradeDuplicate";
import type { Trade, TradeImport } from "@/types/trade";

export type UnmatchedImportRow = {
  row: number;
  code: string;
  description: string;
};

export type TradeImportRecord = {
  id: string;
  at: string;
  fileName: string;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  unmatched: UnmatchedImportRow[];
  createdIds: string[];
  before: Trade[];
  removed: Trade[];
  undone: boolean;
};

const STORAGE_PREFIX = "otto-trade-imports:";
const MAX_RECORDS = 8;
const MAX_UNMATCHED = 40;

export function tradeSourceLabel(trade: Pick<Trade, "importSource" | "notes">) {
  if (trade.importSource === "robinhood_csv") return "Robinhood";
  if (trade.notes.toLowerCase().includes("robinhood screenshot")) return "Screenshot";
  return "Typed";
}

/** What this file will change on a trade that already exists. */
export function repairPreview(input: {
  openingMissing?: boolean;
  candidateStatus: "open" | "closed";
  match: { status: "open" | "closed"; premiumOpen: number } | null;
  removesExtraClose: boolean;
}): string | null {
  if (!input.match) {
    return input.openingMissing
      ? "This file has the close only. Saving it records the close with no opening credit."
      : null;
  }
  if (
    input.openingMissing &&
    input.match.status === "closed" &&
    Math.abs(input.match.premiumOpen) >= 0.011
  ) {
    return input.removesExtraClose
      ? "Updates the saved close and removes the extra close that has no opening credit."
      : "Updates the saved close and keeps its opening credit.";
  }
  if (input.match.status === "closed" && input.candidateStatus === "open") {
    return "Fills the opening credit on the closed trade and keeps the close.";
  }
  if (input.match.status === "open" && input.candidateStatus === "closed") {
    return "Closes the open trade with this file.";
  }
  if (input.removesExtraClose) return "Updates this trade and removes the extra close.";
  return "Updates the matching trade.";
}

/** Snapshots needed to undo an import: rows that will change, and shadow closes that will be deleted. */
export function importChangeSet(existing: Trade[], items: TradeImport[]) {
  const matches = matchTradesForImport(existing, items);
  const before: Trade[] = [];
  const removed: Trade[] = [];
  const seenBefore = new Set<string>();
  const seenRemoved = new Set<string>();
  items.forEach((item, index) => {
    const match = matches[index];
    if (!match) return;
    if (!seenBefore.has(match.id)) {
      seenBefore.add(match.id);
      before.push(match);
    }
    for (const copy of staleCloseCopies(existing, item, match)) {
      if (seenRemoved.has(copy.id)) continue;
      seenRemoved.add(copy.id);
      removed.push(copy);
    }
  });
  return { before, removed };
}

export function canUndoImport(records: TradeImportRecord[], id: string) {
  const latest = records.find((record) => !record.undone);
  return latest?.id === id;
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function readTradeImportHistory(userId: string): TradeImportRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TradeImportRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeTradeImportHistory(userId: string, records: TradeImportRecord[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(records.slice(0, MAX_RECORDS)));
  window.dispatchEvent(new Event("otto-trade-imports"));
}

export function rememberTradeImport(
  userId: string,
  record: Omit<TradeImportRecord, "id" | "at" | "undone" | "unmatched"> & {
    unmatched?: UnmatchedImportRow[];
  }
) {
  const next: TradeImportRecord = {
    ...record,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    unmatched: (record.unmatched ?? []).slice(0, MAX_UNMATCHED),
    undone: false,
  };
  const history = readTradeImportHistory(userId);
  writeTradeImportHistory(userId, [next, ...history]);
  return next;
}

export function markTradeImportUndone(userId: string, id: string) {
  writeTradeImportHistory(
    userId,
    readTradeImportHistory(userId).map((record) =>
      record.id === id ? { ...record, undone: true } : record
    )
  );
}
