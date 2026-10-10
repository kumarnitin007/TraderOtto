import { describe, expect, it } from "vitest";
import { parseRobinhoodCsv, robinhoodCandidateToTradeImport } from "@/lib/robinhoodCsv";
import {
  matchOpenTradesForClose,
  matchTradesForImport,
} from "@/lib/tradeDuplicate";
import type { Trade } from "@/types/trade";

const csv = [
  "Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount",
  "9/30/2026,9/30/2026,10/1/2026,SPCX,SPCX 10/30/2026 Put $135.00,BTC,1,$1.71,($171.04)",
  "9/30/2026,9/30/2026,10/1/2026,SPCX,SPCX 10/30/2026 Put $115.00,STC,1,$0.27,$26.94",
  "9/30/2026,9/30/2026,10/1/2026,SPCX,SPCX 10/30/2026 Put $125.00,STC,1,$0.63,$62.94",
  "9/30/2026,9/30/2026,10/1/2026,SPCX,SPCX 10/30/2026 Put $130.00,BTC,1,$1.03,($103.04)",
  "9/25/2026,9/25/2026,9/28/2026,SPCX,SPCX 10/30/2026 Put $135.00,STO,1,$2.95,$294.94",
  "9/25/2026,9/25/2026,9/28/2026,SPCX,SPCX 10/30/2026 Put $115.00,BTO,1,$0.50,($50.04)",
].join("\n");

function openTrade(overrides: Partial<Trade>): Trade {
  return {
    id: "open",
    ticker: "SPCX",
    strategy: "Put Credit Spread",
    contracts: 1,
    expiry: "2026-10-30",
    openDate: "2026-09-20",
    shortStrike: 130,
    longStrike: 125,
    callShortStrike: null,
    callLongStrike: null,
    stockPriceOpen: 0,
    iv: 0,
    delta: 0,
    sigma: 0,
    theta: 0,
    premiumOpen: 2,
    status: "open",
    closeDate: null,
    stockPriceClose: null,
    premiumClose: null,
    notes: "",
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

describe("robinhood csv spreads", () => {
  it("closes a spread that opened in the file and pairs a close-only spread", () => {
    const parsed = parseRobinhoodCsv(csv);
    const spreads = parsed.candidates
      .filter((item) => item.ticker === "SPCX")
      .map((item) => ({
        strategy: item.strategy,
        status: item.status,
        shortStrike: item.shortStrike,
        longStrike: item.longStrike,
        openDate: item.openDate,
        closeDate: item.closeDate,
        premiumOpen: item.premiumOpen,
        premiumClose: item.premiumClose,
        openingMissing: Boolean(item.openingMissing),
      }));

    expect(spreads).toEqual([
      {
        strategy: "Put Credit Spread",
        status: "closed",
        shortStrike: 135,
        longStrike: 115,
        openDate: "2026-09-25",
        closeDate: "2026-09-30",
        premiumOpen: 2.45,
        premiumClose: 1.44,
        openingMissing: false,
      },
      {
        strategy: "Put Credit Spread",
        status: "closed",
        shortStrike: 130,
        longStrike: 125,
        openDate: "2026-09-30",
        closeDate: "2026-09-30",
        premiumOpen: 0,
        premiumClose: 0.4,
        openingMissing: true,
      },
    ]);
  });

  it("matches each closed spread to the open trade with the same strikes", () => {
    const parsed = parseRobinhoodCsv(csv);
    const imports = parsed.candidates.map(robinhoodCandidateToTradeImport);
    const opens = [
      openTrade({ id: "wide", shortStrike: 135, longStrike: 115, openDate: "2026-09-25", premiumOpen: 2.45 }),
      openTrade({ id: "tight", shortStrike: 130, longStrike: 125, openDate: "2026-09-20", premiumOpen: 1.8 }),
    ];
    expect(matchOpenTradesForClose(opens, imports).map((trade) => trade?.id)).toEqual([
      "wide",
      "tight",
    ]);
  });

  it("reconciles an imported open spread with a manually entered position", () => {
    const manual = openTrade({
      ticker: "TSLA",
      expiry: "2026-10-16",
      shortStrike: 335,
      longStrike: 325,
      openDate: "2026-09-27",
      premiumOpen: 3,
    });
    const imported = {
      ...robinhoodCandidateToTradeImport(parseRobinhoodCsv([
        "Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount",
        "9/28/2026,9/28/2026,9/29/2026,TSLA,TSLA 10/16/2026 Put $325.00,BTO,1,$2.25,($225.04)",
        "9/28/2026,9/28/2026,9/29/2026,TSLA,TSLA 10/16/2026 Put $335.00,STO,1,$3.85,$384.94",
      ].join("\n")).candidates[0]),
    };

    expect(matchTradesForImport([manual], [imported])[0]?.id).toBe(manual.id);
  });

  it("pairs two same-day put credit spread closes in file order", () => {
    const parsed = parseRobinhoodCsv(
      [
        "Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount",
        '10/9/2026,10/9/2026,10/13/2026,GOOG,GOOG 10/16/2026 Put $310.00,STC,1,$0.10,$9.95',
        '10/9/2026,10/9/2026,10/13/2026,GOOG,GOOG 10/16/2026 Put $330.00,BTC,1,$0.51,($51.04)',
        '10/9/2026,10/9/2026,10/13/2026,GOOG,GOOG 10/16/2026 Put $305.00,STC,1,$0.07,$6.95',
        '10/9/2026,10/9/2026,10/13/2026,GOOG,GOOG 10/16/2026 Put $325.00,BTC,1,$0.29,($29.04)',
      ].join("\n")
    );
    const spreads = parsed.candidates.map((item) => ({
      strategy: item.strategy,
      status: item.status,
      shortStrike: item.shortStrike,
      longStrike: item.longStrike,
      closeDate: item.closeDate,
      openingMissing: Boolean(item.openingMissing),
    }));

    expect(spreads).toEqual([
      {
        strategy: "Put Credit Spread",
        status: "closed",
        shortStrike: 330,
        longStrike: 310,
        closeDate: "2026-10-09",
        openingMissing: true,
      },
      {
        strategy: "Put Credit Spread",
        status: "closed",
        shortStrike: 325,
        longStrike: 305,
        closeDate: "2026-10-09",
        openingMissing: true,
      },
    ]);

    const imports = parsed.candidates.map(robinhoodCandidateToTradeImport);
    const opens = [
      openTrade({
        id: "wide",
        ticker: "GOOG",
        expiry: "2026-10-16",
        shortStrike: 330,
        longStrike: 310,
      }),
      openTrade({
        id: "tight",
        ticker: "GOOG",
        expiry: "2026-10-16",
        shortStrike: 325,
        longStrike: 305,
      }),
    ];
    expect(matchOpenTradesForClose(opens, imports).map((trade) => trade?.id)).toEqual([
      "wide",
      "tight",
    ]);
  });
});
