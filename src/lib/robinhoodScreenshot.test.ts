import { describe, expect, it } from "vitest";
import { parseRobinhoodScreenshot } from "@/lib/robinhoodScreenshot";

describe("Robinhood screenshot parser", () => {
  it("reads a closed call credit spread card with comma strikes", () => {
    const parsed = parseRobinhoodScreenshot(`
      SPXW 7,750/7,755 Call Credit Spread 9/25
      Closed on Sep 25, 2026
      Credit at open
      +$110.00
      $1.10 avg x 100 x 1 contract
      Cost at close
      -$70.00
      $0.70 avg x 100 x 1 contract
      Realized profit
      +$40.00
      +36.37%
    `);

    expect(parsed).toMatchObject({
      ticker: "SPXW",
      strategy: "Call Credit Spread",
      shortStrike: "7750",
      longStrike: "7755",
      contracts: "1",
      expiry: "2026-09-25",
      openDate: "2026-09-25",
      closeDate: "2026-09-25",
      premiumOpen: "1.1",
      premiumClose: "0.7",
      closed: true,
      closeReason: "closed",
    });
  });
});
