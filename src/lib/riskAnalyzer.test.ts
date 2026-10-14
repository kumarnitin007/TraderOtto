import { describe, expect, it } from "vitest";
import { analyzeTradeRisk } from "@/lib/riskAnalyzer";
import type { Trade } from "@/types/trade";

function trade(patch: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    ticker: "TSLA",
    strategy: "Put Credit Spread",
    contracts: 1,
    expiry: "2026-10-16",
    openDate: "2026-09-28",
    shortStrike: 335,
    longStrike: 325,
    callShortStrike: null,
    callLongStrike: null,
    stockPriceOpen: 400,
    iv: 0,
    delta: 0,
    sigma: 0,
    theta: 0,
    premiumOpen: 1.6,
    status: "open",
    closeDate: null,
    stockPriceClose: null,
    premiumClose: null,
    notes: "",
    createdAt: "2026-09-28T14:44:00Z",
    updatedAt: "2026-09-28T14:44:00Z",
    ...patch,
  };
}

describe("risk analyzer", () => {
  it("raises the score for earnings, short expiry, and a nearby strike", () => {
    const report = analyzeTradeRisk(trade(), {
      today: "2026-09-29",
      earningsDate: "2026-10-10",
      spot: 340,
      sameTickerOpenTrades: 2,
    });

    expect(report.score).toBeGreaterThanOrEqual(60);
    expect(report.factors.map((factor) => factor.id)).toEqual(
      expect.arrayContaining(["earnings", "expiry", "strike-distance", "concentration"])
    );
    expect(report.capitalAtRisk).toBe(840);
  });

  it("scores an in-the-money short strike above a close out-of-the-money strike", () => {
    const intel = analyzeTradeRisk(
      trade({
        ticker: "INTC",
        expiry: "2026-10-16",
        shortStrike: 110,
        longStrike: 100,
        premiumOpen: 1,
      }),
      { today: "2026-10-13", spot: 102.85 }
    );
    const gld = analyzeTradeRisk(
      trade({
        ticker: "GLD",
        expiry: "2026-10-30",
        shortStrike: 375,
        longStrike: 355,
        premiumOpen: 1,
      }),
      { today: "2026-10-13", spot: 382.5, sameTickerOpenTrades: 2 }
    );

    expect(intel.factors.find((factor) => factor.id === "strike-distance")?.points).toBe(42);
    expect(gld.factors.find((factor) => factor.id === "strike-distance")?.points).toBe(18);
    expect(intel.score).toBeGreaterThan(gld.score);
  });

  it("keeps a longer defined-risk trade low when no event overlaps", () => {
    const report = analyzeTradeRisk(
      trade({ expiry: "2027-01-15", shortStrike: 300, longStrike: 290 }),
      {
        today: "2026-09-29",
        earningsDate: "2027-02-01",
        spot: 400,
        sameTickerOpenTrades: 1,
      }
    );

    expect(report.level).toBe("Low");
    expect(report.factors.find((factor) => factor.id === "earnings-clear")).toBeTruthy();
  });
});
