import { describe, expect, it } from "vitest";
import { bankFocus, daysUntil, displayCurrency, nativeTotal, netWorth, nextPayoutOn, toHome } from "@/lib/banks";
import type { BankAccount, BankDeposit } from "@/types/bank";

function account(patch: Partial<BankAccount>): BankAccount {
  return {
    id: "1",
    country: "us",
    kind: "checking",
    institution: "Bank",
    nickname: "",
    owner: "",
    currency: "USD",
    balance: 100,
    last4: "",
    nominee: "",
    notes: "",
    ...patch,
  };
}

function deposit(patch: Partial<BankDeposit> = {}): BankDeposit {
  return {
    id: "d",
    country: "in",
    kind: "fd",
    institution: "Bank",
    nickname: "",
    owner: "",
    currency: "INR",
    principal: 8000,
    rate: 7,
    payout: "quarterly",
    startedOn: "2026-01-01",
    maturesOn: "2027-01-01",
    renew: "close",
    nominee: "",
    notes: "",
    closed: false,
    ...patch,
  };
}

describe("banks", () => {
  it("converts INR into the home currency only when a rate is set", () => {
    expect(toHome(83, "INR", "USD", null)).toBeNull();
    expect(toHome(83, "INR", "USD", 83)).toBe(1);
  });

  it("counts cash, deposits, and investments, and subtracts loans", () => {
    const worth = netWorth(
      [
        account({ balance: 200, kind: "checking" }),
        account({ id: "2", balance: 50, kind: "trading" }),
        account({ id: "3", balance: 40, kind: "loan" }),
      ],
      [deposit({ currency: "USD", principal: 80, country: "us" })],
      "USD",
      null
    );
    expect(worth.total).toBe(290);
    expect(worth.liabilities).toBe(40);
  });

  it("leaves a closed deposit out of the total", () => {
    const worth = netWorth([], [deposit({ currency: "USD", principal: 80, closed: true, country: "us" })], "USD", null);
    expect(worth.total).toBe(0);
  });

  it("counts days until a maturity date", () => {
    expect(daysUntil("2026-10-06", new Date(2026, 8, 29))).toBe(7);
  });

  it("stays in the one currency on the books", () => {
    const rows = [account({ currency: "INR", country: "in", balance: 500 })];
    expect(displayCurrency(rows, [], "USD")).toBe("INR");
    expect(displayCurrency([], [], "USD")).toBe("USD");
    expect(displayCurrency(rows, [deposit()], "USD")).toBe("INR");
    expect(displayCurrency([account({ id: "usd" })], [deposit()], "USD")).toBe("USD");
    expect(nativeTotal(rows, [deposit({ closed: true, principal: 99 })], "INR")).toBe(500);
  });

  it("finds the next quarterly interest date and stops at maturity", () => {
    const open = deposit({ startedOn: "2026-01-15", maturesOn: "2027-01-15", payout: "quarterly" });
    expect(nextPayoutOn(open, new Date(2026, 8, 29))).toBe("2026-10-15");
    expect(nextPayoutOn({ ...open, maturesOn: "2026-04-01" }, new Date(2026, 2, 1))).toBeNull();
    expect(nextPayoutOn(deposit({ payout: "monthly", startedOn: "2026-01-31" }), new Date(2026, 0, 31))).toBe("2026-02-28");
  });

  it("lists a closing deposit and a nearby interest date as focus", () => {
    const today = new Date(2026, 8, 29);
    const focus = bankFocus(
      [
        deposit({ id: "fd", maturesOn: "2026-10-06", payout: "maturity", renew: "close" }),
        deposit({ id: "scss", kind: "scss", payout: "quarterly", startedOn: "2026-01-15", maturesOn: "2031-01-15" }),
        deposit({ id: "done", closed: true, maturesOn: "2026-10-01" }),
      ],
      today
    );
    expect(focus.map((item) => item.depositId)).toEqual(["fd", "scss"]);
    expect(focus[0].detail).toContain("Closes in 7d");
    expect(focus[0].detail).toContain("Money comes back");
    expect(focus[1].detail).toContain("Quarterly interest");
  });
});
