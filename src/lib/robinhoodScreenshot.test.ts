import { describe, expect, it } from "vitest";
import { parseRobinhoodScreenshot } from "@/lib/robinhoodScreenshot";

describe("Robinhood screenshot parser", () => {
  it("reads a filled opening order for a put credit spread", () => {
    const parsed = parseRobinhoodScreenshot(
      `
      Filled order
      Active
      TSLA $325/$335 Put Credit Spread
      10/16
      Quantity
      1
      Filled quantity
      1 filled at $1.60
      Filled
      9/28, 7:44 AM PDT
      Limit price
      $1.60
      Est credit
      $159.92
      Legs
      $335 Put 10/16
      1 sell to open
      $325 Put 10/16
      1 buy to open
    `,
      new Date(2026, 8, 29)
    );

    expect(parsed).toMatchObject({
      ticker: "TSLA",
      strategy: "Put Credit Spread",
      shortStrike: "335",
      longStrike: "325",
      contracts: "1",
      expiry: "2026-10-16",
      openDate: "2026-09-28",
      premiumOpen: "1.6",
      closed: undefined,
    });
  });

  it("reads the fill date when the order screen is laid out in columns", () => {
    const parsed = parseRobinhoodScreenshot(
      `
      8:29
      Filled order
      Active
      TSLA $325/$335 Put Credit Spread 10/16
      Time in force Submitted
      Good for day 9/28, 7:43 AM PDT
      Quantity Filled quantity
      1 1 filled at $1.60
      Filled Limit price
      9/28, 7:44 AM PDT $1.60
      Est credit Est regulatory fees
      $159.92 $0.08
      $335 Put 10/16
      1 sell to open $3.85
      $325 Put 10/16
      1 buy to open $2.25
    `,
      new Date(2026, 8, 29)
    );

    expect(parsed.openDate).toBe("2026-09-28");
    expect(parsed.expiry).toBe("2026-10-16");
    expect(parsed.premiumOpen).toBe("1.6");
    expect(parsed.shortStrike).toBe("335");
    expect(parsed.longStrike).toBe("325");
  });

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
