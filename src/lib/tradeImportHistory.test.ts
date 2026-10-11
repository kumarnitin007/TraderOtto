import { describe, expect, it } from "vitest";
import { parseRobinhoodCsv, robinhoodCandidateToTradeImport } from "@/lib/robinhoodCsv";
import {
  canUndoImport,
  importChangeSet,
  repairPreview,
  tradeSourceLabel,
  type TradeImportRecord,
} from "@/lib/tradeImportHistory";
import type { Trade, TradeImport } from "@/types/trade";

const header =
  "Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount";

function imported(csv: string) {
  const candidate = parseRobinhoodCsv(csv).candidates[0];
  if (!candidate) throw new Error("missing candidate");
  return robinhoodCandidateToTradeImport(candidate);
}

function saved(item: TradeImport, overrides: Partial<Trade> = {}): Trade {
  return {
    id: overrides.id ?? "saved",
    ticker: item.ticker,
    strategy: item.strategy,
    contracts: item.contracts,
    expiry: item.expiry,
    openDate: item.openDate,
    shortStrike: item.shortStrike,
    longStrike: item.longStrike,
    callShortStrike: item.callShortStrike,
    callLongStrike: item.callLongStrike,
    stockPriceOpen: item.stockPriceOpen,
    iv: 0,
    delta: 0,
    sigma: 0,
    theta: 0,
    premiumOpen: item.premiumOpen,
    commissionOpen: item.commissionOpen,
    status: item.status,
    closeDate: item.closeDate ?? null,
    stockPriceClose: item.stockPriceClose ?? null,
    premiumClose: item.premiumClose ?? null,
    commissionClose: item.commissionClose,
    notes: item.notes,
    importSource: item.importSource,
    importFingerprint: item.importFingerprint,
    createdAt: "2026-10-08T00:00:00Z",
    updatedAt: "2026-10-08T00:00:00Z",
    ...overrides,
  };
}

const closeFile = [
  header,
  "10/8/2026,10/8/2026,10/9/2026,NFLX,NFLX 10/16/2026 Put $65.00,BTC,1,$0.05,($5.04)",
  "10/8/2026,10/8/2026,10/9/2026,NFLX,NFLX 10/16/2026 Put $60.00,STC,1,$0.02,$1.95",
].join("\n");

describe("trade import history", () => {
  it("names Robinhood, screenshot, and typed trades", () => {
    expect(tradeSourceLabel({ importSource: "robinhood_csv", notes: "" })).toBe("Robinhood");
    expect(tradeSourceLabel({ importSource: null, notes: "Imported from Robinhood screenshot" })).toBe(
      "Screenshot"
    );
    expect(tradeSourceLabel({ importSource: null, notes: "" })).toBe("Typed");
  });

  it("describes a close-only file that would update a complete trade", () => {
    expect(
      repairPreview({
        openingMissing: true,
        candidateStatus: "closed",
        match: { status: "closed", premiumOpen: 0.41 },
        removesExtraClose: true,
      })
    ).toMatch(/removes the extra close/i);
  });

  it("snapshots the complete close and the extra close a repeated file would remove", () => {
    const closeImport = imported(closeFile);
    const complete = saved(closeImport, { id: "complete", premiumOpen: 0.41, openDate: "2026-10-01" });
    const shadow = saved(closeImport, { id: "shadow", premiumOpen: 0 });
    const change = importChangeSet([complete, shadow], [closeImport]);
    expect(change.before.map((trade) => trade.id)).toEqual(["complete"]);
    expect(change.removed.map((trade) => trade.id)).toEqual(["shadow"]);
  });

  it("allows undo only for the newest import that has not been undone", () => {
    const records = [
      { id: "new", undone: false },
      { id: "old", undone: false },
    ] as TradeImportRecord[];
    expect(canUndoImport(records, "new")).toBe(true);
    expect(canUndoImport(records, "old")).toBe(false);
    expect(canUndoImport([{ id: "new", undone: true }, { id: "old", undone: false }] as TradeImportRecord[], "old")).toBe(
      true
    );
  });
});
