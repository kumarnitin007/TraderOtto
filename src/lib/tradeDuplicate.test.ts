import { describe, expect, it } from "vitest";
import { realizedPnl } from "@/lib/pnl";
import { parseRobinhoodCsv, robinhoodCandidateToTradeImport } from "@/lib/robinhoodCsv";
import { potentialDuplicateTrades } from "@/lib/tradePotentialDuplicate";
import {
  applyImportToTrade,
  isDuplicateImportedTrade,
  matchTradesForImport,
  staleCloseCopies,
} from "@/lib/tradeDuplicate";
import type { Trade, TradeImport } from "@/types/trade";

const header =
  "Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount";

const nflxOpenFile = [
  header,
  "10/1/2026,10/1/2026,10/2/2026,NFLX,NFLX 10/16/2026 Put $60.00,BTO,1,$0.08,($8.04)",
  "10/1/2026,10/1/2026,10/2/2026,NFLX,NFLX 10/16/2026 Put $65.00,STO,1,$0.49,$48.95",
].join("\n");

const nflxCloseFile = [
  header,
  '10/8/2026,10/8/2026,10/9/2026,NFLX,NFLX 10/16/2026 Put $65.00,BTC,1,$0.05,($5.04)',
  '10/8/2026,10/8/2026,10/9/2026,NFLX,NFLX 10/16/2026 Put $60.00,STC,1,$0.02,$1.95',
].join("\n");

function imported(csv: string) {
  const candidate = parseRobinhoodCsv(csv).candidates.find((item) => item.ticker === "NFLX");
  if (!candidate) throw new Error("missing NFLX candidate");
  return robinhoodCandidateToTradeImport(candidate);
}

function saved(item: TradeImport, overrides: Partial<Trade> = {}): Trade {
  return {
    id: "saved",
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
    closeReason: item.closeReason,
    importSource: item.importSource,
    importFingerprint: item.importFingerprint,
    notes: item.notes,
    createdAt: "2026-10-08T00:00:00Z",
    updatedAt: "2026-10-08T00:00:00Z",
    ...overrides,
  };
}

describe("robinhood files that split an open and a close", () => {
  const openImport = imported(nflxOpenFile);
  const closeImport = imported(nflxCloseFile);

  it("repairs a close that was saved before the opening file arrived", () => {
    const placeholder = saved(closeImport, { id: "placeholder" });
    expect(matchTradesForImport([placeholder], [openImport])[0]?.id).toBe("placeholder");
    const merged = applyImportToTrade(placeholder, openImport);
    expect(merged.status).toBe("closed");
    expect(merged.openDate).toBe("2026-10-01");
    expect(merged.closeDate).toBe("2026-10-08");
    expect(merged.premiumOpen).toBeCloseTo(0.41);
    expect(merged.premiumClose).toBeCloseTo(0.03);
    expect(
      realizedPnl(merged.premiumOpen, merged.premiumClose ?? 0, 1, merged.strategy, {
        commissionOpen: merged.commissionOpen,
        commissionClose: merged.commissionClose,
      })
    ).toBeCloseTo(37.82);
  });

  it("treats a later close-only file as the same position once the open is recorded", () => {
    const opened = saved(openImport, { id: "open", status: "open", closeDate: null, premiumClose: null });
    const closed = applyImportToTrade(opened, closeImport);
    const recorded = saved(openImport, {
      id: "recorded",
      status: "closed",
      openDate: closed.openDate,
      closeDate: closed.closeDate,
      premiumOpen: closed.premiumOpen,
      premiumClose: closed.premiumClose,
      commissionOpen: closed.commissionOpen,
      commissionClose: closed.commissionClose,
      importFingerprint: "rh-real",
    });
    const placeholder = saved(closeImport, { id: "placeholder", importFingerprint: "rh-shadow" });

    expect(matchTradesForImport([recorded, placeholder], [closeImport])[0]?.id).toBe("recorded");
    expect(staleCloseCopies([recorded, placeholder], closeImport, recorded).map((trade) => trade.id)).toEqual([
      "placeholder",
    ]);
    expect(isDuplicateImportedTrade(placeholder, closeImport)).toBe(true);
  });

  it("refreshes the opening fees when the opening file is loaded after the close", () => {
    const recorded = saved(closeImport, {
      id: "recorded",
      openDate: "2026-10-01",
      premiumOpen: 0.41,
      commissionOpen: 0,
      importFingerprint: "rh-real",
    });
    const placeholder = saved(closeImport, { id: "placeholder" });
    expect(matchTradesForImport([recorded, placeholder], [openImport])[0]?.id).toBe("recorded");
    const merged = applyImportToTrade(recorded, openImport);
    expect(merged.premiumOpen).toBeCloseTo(0.41);
    expect(merged.commissionOpen).toBeCloseTo(0.09);
    expect(merged.premiumClose).toBeCloseTo(0.03);
    expect(merged.closeDate).toBe("2026-10-08");
    expect(staleCloseCopies([recorded, placeholder], openImport, recorded).map((trade) => trade.id)).toEqual([
      "placeholder",
    ]);
  });

  it("flags the close-only copy and recommends the row that has the opening credit", () => {
    const recorded = saved(openImport, {
      id: "recorded",
      status: "closed",
      closeDate: "2026-10-08",
      premiumClose: 0.03,
      commissionClose: 0.09,
    });
    const placeholder = saved(closeImport, { id: "placeholder" });
    const groups = potentialDuplicateTrades([recorded, placeholder]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.recommendedId).toBe("recorded");
  });
});
