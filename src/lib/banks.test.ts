import { describe, expect, it } from "vitest";
import { bankFocus, daysUntil, displayCurrency, duplicateHoldingIds, FALLBACK_INR_PER_USD, inrPerUsdFromRatePayload, moneyWhole, nativeTotal, netWorth, nextPayoutOn, sortHoldings, toHome, totalsRate } from "@/lib/banks";
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
    const negative = netWorth(
      [
        account({ balance: 200, kind: "checking" }),
        account({ id: "2", balance: 50, kind: "trading" }),
        account({ id: "3", balance: -40, kind: "loan" }),
      ],
      [deposit({ currency: "USD", principal: 80, country: "us" })],
      "USD",
      null
    );
    expect(negative.liabilities).toBe(40);
    expect(negative.total).toBe(290);
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

  it("sorts holdings by amount, type, and owner", () => {
    const accounts = [
      account({ id: "loan", kind: "loan", institution: "Card bank", balance: 40, owner: "Sam", currency: "USD" }),
      account({ id: "cash", kind: "checking", institution: "Credit union", balance: 10, owner: "Alex", currency: "INR" }),
    ];
    const deposits = [deposit({ id: "fd", institution: "State bank", principal: 25, owner: "Alex" })];
    const ids = (sort: "amount-desc" | "type" | "owner") =>
      sortHoldings(accounts, deposits, sort).map((row) => (row.kind === "account" ? row.account.id : row.deposit.id));
    expect(ids("amount-desc")).toEqual(["loan", "fd", "cash"]);
    expect(ids("type")).toEqual(["cash", "fd", "loan"]);
    expect(ids("owner")).toEqual(["cash", "fd", "loan"]);
  });

  it("sorts mixed currencies by their converted home-currency amounts", () => {
    const accounts = [
      account({ id: "usd", institution: "US bank", balance: 3, currency: "USD" }),
      account({ id: "inr", institution: "India bank", balance: 160, currency: "INR" }),
    ];
    const sorted = sortHoldings(
      accounts,
      [],
      "amount-desc",
      "USD",
      80
    ).map((row) => (row.kind === "account" ? row.account.id : row.deposit.id));

    expect(sorted).toEqual(["usd", "inr"]);
  });

  it("uses 100 rupees per dollar only when both currencies have no saved rate", () => {
    const mixedAccounts = [account({ id: "usd" })];
    const mixedDeposits = [deposit()];
    expect(totalsRate(mixedAccounts, mixedDeposits, null)).toEqual({ rate: FALLBACK_INR_PER_USD, fallback: true });
    expect(totalsRate(mixedAccounts, mixedDeposits, 83)).toEqual({ rate: 83, fallback: false });
    expect(totalsRate([account({})], [], null)).toEqual({ rate: null, fallback: false });
  });

  it("marks two holdings with the same name, and keeps numbered deposits apart", () => {
    const ids = duplicateHoldingIds(
      [
        account({ id: "a", institution: "PF Pension", kind: "trading" }),
        account({ id: "b", institution: "PF Pension", kind: "trading" }),
        account({ id: "c", nickname: "Empower RET", institution: "Empower", kind: "trading" }),
      ],
      [
        deposit({ id: "d1", notes: "No. 111" }),
        deposit({ id: "d2", notes: "No. 222" }),
      ]
    );
    expect([...ids].sort()).toEqual(["a", "b"]);
  });

  it("reads an approximate rupee rate from a daily quote", () => {
    expect(inrPerUsdFromRatePayload({ rates: { INR: 83.456 } })).toBe(83.46);
    expect(inrPerUsdFromRatePayload({ rates: {} })).toBeNull();
    expect(moneyWhole(112233000, "INR")).toBe("₹11,22,33,000");
    expect(moneyWhole(1111222, "USD")).toBe("$1,111,222");
  });
});
